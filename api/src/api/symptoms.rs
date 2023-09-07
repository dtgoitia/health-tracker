use chrono::{DateTime, Utc};
use poem::web::Data;
use poem_openapi::ApiResponse;
use poem_openapi::{param::Path, payload::Json, Object, OpenApi};
use tracing::{error, info, warn};

use crate::{
    api::{
        common::{ApiTags, SEE_LOGS},
        security::validate_api_key,
    },
    db::{self},
    domain::{
        self, generate_symptom_id, DateTimeIsoString, SymptomId, SymptomName, SymptomOtherNames,
    },
};

use super::error::ErrorResponse;
use super::security::ApiKeyAuth;
use super::start::ApiContext;

pub struct Endpoints {}

#[derive(Object, Debug, PartialEq, Eq, Clone)]
pub struct Symptom {
    pub id: SymptomId,
    pub name: SymptomName,
    pub other_names: SymptomOtherNames,
    updated_at: DateTimeIsoString,
}

impl From<domain::Symptom> for Symptom {
    fn from(symptom: domain::Symptom) -> Symptom {
        Symptom {
            id: symptom.id,
            name: symptom.name,
            other_names: symptom.other_names,
            updated_at: symptom.updated_at.to_rfc3339(),
        }
    }
}

pub fn api_symptom_to_domain(
    api_symptom: Symptom,
    published_at: DateTime<Utc>,
) -> Result<domain::Symptom, String> {
    let updated_at: DateTime<Utc> = match DateTime::parse_from_rfc3339(&api_symptom.updated_at) {
        Ok(updated_at) => updated_at.into(),
        Err(error) => return Err(format!("invalid updated_at, reason: {error:?}")),
    };

    let domain_symptom = domain::Symptom {
        id: api_symptom.id,
        published_at,
        name: api_symptom.name,
        other_names: api_symptom.other_names,
        updated_at,
    };

    Ok(domain_symptom)
}

#[derive(Object, Debug)]
struct CreateSymptomRequestBody {
    id: Option<SymptomId>,
    name: SymptomName,
    other_names: Vec<SymptomName>,
    updated_at: DateTimeIsoString,
}

#[derive(ApiResponse)]
enum CreateSymptomResponse {
    /// Symptom successfuly created
    #[oai(status = 200)]
    Success(Json<CreateSymptomResponseBody>),

    /// Invalid symptom payload
    #[oai(status = 400)]
    InvalidPayload(Json<ErrorResponse>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,

    // /// The symptom already exists
    // #[oai(status = 409)]
    // SymptomAlreadyExists,
    /// Valid request, but could not process some reason
    #[oai(status = 422)]
    OtherError(Json<ErrorResponse>),
}

#[derive(Object, Debug)]
struct CreateSymptomResponseBody {
    created_symptom: Symptom,
}

#[derive(ApiResponse)]
enum ReadSymptomsResponse {
    /// Symptoms successfuly read
    #[oai(status = 200)]
    Success(Json<ReadSymptomsResponseBody>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,

    /// Valid request, but could not process some reason
    #[oai(status = 422)]
    OtherError(Json<ErrorResponse>),
}

#[derive(Object, Debug)]
struct ReadSymptomsResponseBody {
    symptoms: Vec<Symptom>,
}

#[derive(ApiResponse)]
enum UpdateSymptomResponse {
    /// Symptom successfuly updated
    #[oai(status = 200)]
    Success(Json<UpdateSymptomResponseBody>),

    /// Invalid symptom payload
    #[oai(status = 400)]
    InvalidPayload(Json<ErrorResponse>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,

    /// The provided symptom does not exist so it cannot be updated
    #[oai(status = 409)]
    SymptomDoesNotExist(Json<ErrorResponse>),

    /// Valid request, but could not process some reason
    #[oai(status = 422)]
    OtherError(Json<ErrorResponse>),
}

#[derive(Object, Debug)]
struct UpdateSymptomRequestBody {
    name: Option<SymptomName>,
    other_names: Option<Vec<SymptomName>>,
    updated_at: Option<DateTimeIsoString>,
}

#[derive(Object, Debug)]
struct UpdateSymptomResponseBody {
    updated_symptom: Symptom,
}

#[derive(ApiResponse)]
enum DeleteSymptomResponse {
    /// Symptom successfuly updated
    #[oai(status = 200)]
    Success(Json<DeleteSymptomResponseBody>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,

    /// The provided symptom does not exist so it cannot be deleted
    #[oai(status = 404)]
    SymptomDoesNotExist(Json<ErrorResponse>),

    /// Valid request, but could not process some reason
    #[oai(status = 422)]
    OtherError(Json<ErrorResponse>),
}

#[derive(Object, Debug)]
struct DeleteSymptomResponseBody {
    deleted_symptom: SymptomId,
}

#[OpenApi(tag = "ApiTags::Symptoms")]
impl Endpoints {
    /// Create a new symptom
    #[oai(path = "/symptoms", method = "post")]
    async fn create_symptom(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
        payload: Json<CreateSymptomRequestBody>,
    ) -> CreateSymptomResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to create sypmtom, reason: invalid API key");
            return CreateSymptomResponse::InvalidApiKey;
        };

        let published_at: DateTime<Utc> = chrono::offset::Utc::now();

        let id: String = match payload.id.clone() {
            Some(id) => id,
            None => generate_symptom_id(),
        };

        let updated_at = match DateTime::parse_from_rfc3339(&payload.updated_at) {
            Ok(updated_at) => updated_at.into(),
            Err(error) => {
                let invalid = &payload.updated_at;
                error!("failed to map payload 'updated_at' to Datetime<Utc>, reason: {error}, invalid value: {invalid:?}");
                let reason = "'updated_at' must be a valid date (RFC3339)".to_string();
                return CreateSymptomResponse::InvalidPayload(Json(ErrorResponse {
                    error: reason,
                }));
            }
        };

        let symptom = domain::Symptom {
            id: id.clone(),
            published_at,
            name: payload.name.to_string(),
            other_names: payload.other_names.clone(),
            updated_at,
        };

        match db::create_symptom(symptom.clone().into(), &context.db_pool).await {
            Ok(()) => (),
            Err(db::DbError::FailedToCreateSymptom(reason)) => {
                let reason = format!("failed to create symptom, reason {reason}");
                error!("{reason}");
                return CreateSymptomResponse::OtherError(Json(ErrorResponse {
                    error: SEE_LOGS.to_string(),
                }));
            }
            Err(_) => unreachable!(),
        }

        info!("symptom created: {id}");

        CreateSymptomResponse::Success(Json(CreateSymptomResponseBody {
            created_symptom: symptom.into(),
        }))
    }

    /// Retrieve all symptoms
    #[oai(path = "/symptoms", method = "get")]
    async fn read_all_symptoms(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
    ) -> ReadSymptomsResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to read sypmtoms, reason: invalid API key");
            return ReadSymptomsResponse::InvalidApiKey;
        };

        let db_symptoms: Vec<db::Symptom> = match db::get_symptoms(&context.db_pool, None).await {
            Ok(symptoms) => symptoms,
            Err(reason) => {
                error!("failed to read symptoms from DB, reason: {reason:?}");
                return ReadSymptomsResponse::OtherError(Json(ErrorResponse {
                    error: SEE_LOGS.to_string(),
                }));
            }
        };

        let mut symptoms: Vec<Symptom> = vec![];
        let mut symptoms_error: Option<String> = None;
        for db_symptom in db_symptoms {
            let domain_symptom: domain::Symptom = match db_symptom.try_into() {
                Ok(symptom) => symptom,
                Err(reason) => {
                    symptoms_error = Some(reason);
                    break;
                }
            };
            let api_symptom: Symptom = domain_symptom.into();
            symptoms.push(api_symptom);
        }

        if symptoms_error.is_some() {
            error!("failed to read symptoms from DB, reason: {symptoms_error:?}");
            return ReadSymptomsResponse::OtherError(Json(ErrorResponse {
                error: SEE_LOGS.to_string(),
            }));
        }

        ReadSymptomsResponse::Success(Json(ReadSymptomsResponseBody { symptoms }))
    }

    /// Update a symptom
    #[oai(path = "/symptoms/:id", method = "patch")]
    async fn update_symptom(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
        id: Path<SymptomId>,
        payload: Json<UpdateSymptomRequestBody>,
    ) -> UpdateSymptomResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to update sypmtom, reason: invalid API key");
            return UpdateSymptomResponse::InvalidApiKey;
        };

        let published_at: DateTime<Utc> = chrono::offset::Utc::now();

        let symptom_id = id.0;
        let before: domain::Symptom =
            match db::get_symptom(symptom_id.clone(), &context.db_pool).await {
                Ok(db_symptom) => {
                    let domain_symptom: domain::Symptom = match db_symptom.try_into() {
                        Ok(domain_symptom) => domain_symptom,
                        Err(reason) => {
                            error!("failed to update symptom {symptom_id:?}, reason: {reason}");
                            return UpdateSymptomResponse::OtherError(Json(ErrorResponse {
                                error: SEE_LOGS.to_string(),
                            }));
                        }
                    };
                    domain_symptom
                }
                Err(error) => {
                    return UpdateSymptomResponse::SymptomDoesNotExist(Json(ErrorResponse {
                        error: format!("{error:?}"),
                    }))
                }
            };

        let mut desired = before.clone();
        desired.published_at = published_at;

        if let Some(updated_name) = payload.name.clone() {
            desired.name = updated_name;
        }

        if let Some(updated_other_names) = payload.other_names.clone() {
            desired.other_names = updated_other_names;
        }

        if let Some(updated_updated_at) = payload.updated_at.clone() {
            desired.updated_at = match DateTime::parse_from_rfc3339(&updated_updated_at) {
                Ok(value) => value.into(),
                Err(error) => {
                    let invalid = &updated_updated_at;
                    error!("failed to map payload 'updated_at' to Datetime<Utc>, reason: {error}, invalid value: {invalid:?}");
                    return UpdateSymptomResponse::InvalidPayload(Json(ErrorResponse {
                        error: "'updated_at' must be a valid date (RFC3339)".to_string(),
                    }));
                }
            };
        }

        let updated: domain::Symptom =
            match db::update_symptom(desired.into(), &context.db_pool).await {
                Ok(db_symptom) => {
                    let domain_symptom: domain::Symptom = match db_symptom.try_into() {
                        Ok(domain_symptom) => domain_symptom,
                        Err(reason) => {
                            error!("failed to update symptom {symptom_id:?}, reason: {reason}");
                            return UpdateSymptomResponse::OtherError(Json(ErrorResponse {
                                error: SEE_LOGS.to_string(),
                            }));
                        }
                    };
                    domain_symptom
                }
                Err(db::DbError::FailedToUpdateSymptom(id, reason)) => {
                    error!("failed to update symptom {id}, reason: {reason}");
                    return UpdateSymptomResponse::OtherError(Json(ErrorResponse {
                        error: SEE_LOGS.to_string(),
                    }));
                }
                Err(_) => unreachable!(),
            };

        let id = &updated.id;
        info!("symptom updated: {id}");

        UpdateSymptomResponse::Success(Json(UpdateSymptomResponseBody {
            updated_symptom: updated.into(),
        }))
    }

    /// Delete a symptom
    #[oai(path = "/symptoms/:id", method = "delete")]
    async fn delete_symptom(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
        id: Path<SymptomId>,
    ) -> DeleteSymptomResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to delete sypmtom, reason: invalid API key");
            return DeleteSymptomResponse::InvalidApiKey;
        };

        let id_to_delete = id.0;
        let deleted_id = match db::delete_symptom(id_to_delete.clone(), &context.db_pool).await {
            Ok(()) => id_to_delete,
            Err(db::DeleteSymptomError::SymptomNotFoud(id)) => {
                error!("failed to delete symptom {id}, reason: symptom not found");
                return DeleteSymptomResponse::SymptomDoesNotExist(Json(ErrorResponse {
                    error: "symptom not found, nothing was deleted".to_string(),
                }));
            }
            Err(db::DeleteSymptomError::Other(id, reason)) => {
                error!("failed to delete symptom {id}, reason: {reason}");
                return DeleteSymptomResponse::OtherError(Json(ErrorResponse { error: reason }));
            }
        };

        info!("symptom deleted: {deleted_id}");
        DeleteSymptomResponse::Success(Json(DeleteSymptomResponseBody {
            deleted_symptom: deleted_id,
        }))
    }
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, Utc};

    use crate::{api::symptoms::Symptom, domain};

    #[test]
    fn api_symptom_to_domain_symptom() {
        let api_symptom = Symptom {
            id: "sym_aaaaaaaaaa".to_string(),
            name: "symptom A".to_string(),
            other_names: vec![
                "symptom A name b".to_string(),
                "symptom A name c".to_string(),
            ],
            updated_at: "2023-08-07T07:34:55Z".to_string(),
        };

        let domain_symptom = domain::Symptom::try_from(api_symptom).unwrap();
        assert_eq!(domain_symptom.id, "sym_aaaaaaaaaa".to_string());
        assert_eq!(domain_symptom.name, "symptom A".to_string());
        assert_eq!(
            domain_symptom.other_names,
            vec![
                "symptom A name b".to_string(),
                "symptom A name c".to_string()
            ]
        );
        let expected_updated_at: DateTime<Utc> =
            DateTime::parse_from_rfc3339("2023-08-07T07:34:55Z")
                .unwrap()
                .into();
        assert_eq!(domain_symptom.updated_at, expected_updated_at);
    }

    #[test]
    fn domain_symptom_to_api_symptom() {
        let domain_symptom = domain::Symptom {
            id: "sym_aaaaaaaaaa".to_string(),
            name: "symptom A".to_string(),
            other_names: vec![
                "symptom A name b".to_string(),
                "symptom A name c".to_string(),
            ],
            updated_at: DateTime::parse_from_rfc3339("2023-08-07T07:34:55Z")
                .unwrap()
                .into(),
        };

        let api_symptom: Symptom = domain_symptom.into();
        assert_eq!(api_symptom.id, "sym_aaaaaaaaaa".to_string());
        assert_eq!(api_symptom.name, "symptom A".to_string());
        assert_eq!(
            api_symptom.other_names,
            vec![
                "symptom A name b".to_string(),
                "symptom A name c".to_string()
            ]
        );
        assert_eq!(api_symptom.updated_at, "2023-08-07T07:34:55+00:00");
    }
}
