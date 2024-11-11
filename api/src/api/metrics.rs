use std::str::FromStr;

use chrono::{DateTime, Utc};
use poem::web::Data;
use poem_openapi::{param::Path, payload::Json, ApiResponse, Object, OpenApi};
use tracing::{error, info, warn};

use crate::{
    api::{
        common::{ApiTags, SEE_LOGS},
        security::validate_api_key,
    },
    db::{self},
    domain::{
        self, generate_metric_id, DateTimeIsoString, MetricId, MetricIntensity, MetricNotes,
        SymptomId,
    },
};

use super::{error::ErrorResponse, security::ApiKeyAuth, start::ApiContext};

pub struct Endpoints {}

#[derive(Object, Debug, PartialEq, Eq, Clone)]
pub struct Metric {
    pub id: MetricId,
    pub symptom_id: SymptomId,
    date: DateTimeIsoString,
    updated_at: DateTimeIsoString,
    intensity: String,
    notes: MetricNotes,
}

// domain -> api
impl From<domain::Metric> for Metric {
    fn from(metric: domain::Metric) -> Metric {
        Metric {
            id: metric.id,
            symptom_id: metric.symptom_id,
            date: metric.date.to_rfc3339(),
            updated_at: metric.updated_at.to_rfc3339(),
            intensity: metric.intensity.to_string(),
            notes: metric.notes.to_string(),
        }
    }
}

// api -> domain
pub fn api_metric_to_domain(
    api_metric: Metric,
    published_at: DateTime<Utc>,
) -> Result<domain::Metric, String> {
    let date: DateTime<Utc> = match DateTime::parse_from_rfc3339(&api_metric.date) {
        Ok(date) => date.into(),
        Err(error) => return Err(format!("invalid date, reason: {error:?}")),
    };

    let updated_at: DateTime<Utc> = match DateTime::parse_from_rfc3339(&api_metric.updated_at) {
        Ok(updated_at) => updated_at.into(),
        Err(error) => return Err(format!("invalid updated_at, reason: {error:?}")),
    };

    let intensity = MetricIntensity::from_str(&api_metric.intensity)?;

    let domain_metric = domain::Metric {
        id: api_metric.id,
        published_at,
        updated_at,
        symptom_id: api_metric.symptom_id,
        date,
        intensity,
        notes: api_metric.notes,
    };

    Ok(domain_metric)
}

#[derive(Object, Debug)]
struct CreateMetricRequestBody {
    id: Option<MetricId>,
    symptom_id: SymptomId,
    date: DateTimeIsoString,
    updated_at: DateTimeIsoString,
    intensity: String,
    notes: MetricNotes,
}

impl FromStr for domain::MetricIntensity {
    type Err = String;
    fn from_str(intensity: &str) -> Result<domain::MetricIntensity, Self::Err> {
        match intensity {
            "low" => Ok(domain::MetricIntensity::Low),
            "medium" => Ok(domain::MetricIntensity::Medium),
            "high" => Ok(domain::MetricIntensity::High),
            other => Err(format!("{other} is not a supported intensity")),
        }
    }
}

#[derive(ApiResponse)]
enum CreateMetricResponse {
    /// Metric successfuly created
    #[oai(status = 200)]
    Success(Json<CreateMetricResponseBody>),

    /// Invalid metric payload
    #[oai(status = 400)]
    InvalidPayload(Json<ErrorResponse>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,

    // /// The metric already exists
    // #[oai(status = 409)]
    // MetricAlreadyExists,
    /// Valid request, but could not process some reason
    #[oai(status = 422)]
    OtherError(Json<ErrorResponse>),
}

#[derive(Object, Debug)]
struct CreateMetricResponseBody {
    created_metric: Metric,
}

#[derive(ApiResponse)]
enum ReadMetricsResponse {
    /// Metrics successfuly read
    #[oai(status = 200)]
    Success(Json<ReadMetricsResponseBody>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,
}

#[derive(Object, Debug)]
struct ReadMetricsResponseBody {
    metrics: Vec<Metric>,
}

#[derive(ApiResponse)]
enum UpdateMetricResponse {
    /// Metric successfuly updated
    #[oai(status = 200)]
    Success(Json<UpdateMetricResponseBody>),

    /// Invalid metric payload
    #[oai(status = 400)]
    InvalidPayload(Json<ErrorResponse>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,

    /// The provided metric does not exist so it cannot be updated
    #[oai(status = 409)]
    MetricDoesNotExist(Json<ErrorResponse>),

    /// Valid request, but could not process some reason
    #[oai(status = 422)]
    OtherError(Json<ErrorResponse>),
}

#[derive(Object, Debug)]
struct UpdateMetricRequestBody {
    symptom_id: Option<SymptomId>,
    date: Option<DateTimeIsoString>,
    updated_at: Option<DateTimeIsoString>,
    intensity: Option<String>,
    notes: Option<String>,
}

#[derive(Object, Debug)]
struct UpdateMetricResponseBody {
    updated_metric: Metric,
}

#[derive(ApiResponse)]
enum DeleteMetricResponse {
    /// Metric successfuly updated
    #[oai(status = 200)]
    Success(Json<DeleteMetricResponseBody>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,

    /// The provided metric does not exist so it cannot be deleted
    #[oai(status = 404)]
    MetricDoesNotExist(Json<ErrorResponse>),

    /// Valid request, but could not process some reason
    #[oai(status = 422)]
    OtherError(Json<ErrorResponse>),
}

#[derive(Object, Debug)]
struct DeleteMetricResponseBody {
    deleted_metric: MetricId,
}

#[OpenApi(tag = "ApiTags::Metrics")]
impl Endpoints {
    /// Create a new metric for a symptom
    #[oai(path = "/metrics", method = "post")]
    async fn create_metric(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
        payload: Json<CreateMetricRequestBody>,
    ) -> CreateMetricResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to create metric, reason: invalid API key");
            return CreateMetricResponse::InvalidApiKey;
        };

        let published_at: DateTime<Utc> = chrono::offset::Utc::now();

        let id = match payload.id.clone() {
            Some(id) => id,
            None => generate_metric_id(),
        };

        let date: DateTime<Utc> = match DateTime::parse_from_rfc3339(&payload.date) {
            Ok(date) => date.into(),
            Err(error) => {
                let invalid = &payload.date;
                error!("failed to map payload 'date' to Datetime<Utc>, reason: {error}, invalid value: {invalid:?}");
                return CreateMetricResponse::InvalidPayload(Json(ErrorResponse {
                    error: "'date' must be a valid date (RFC3339)".to_string(),
                }));
            }
        };

        let updated_at: DateTime<Utc> = match DateTime::parse_from_rfc3339(&payload.updated_at) {
            Ok(updated_at) => updated_at.into(),
            Err(error) => {
                let invalid = &payload.updated_at;
                error!("failed to map payload 'updated_at' to Datetime<Utc>, reason: {error}, invalid value: {invalid:?}");
                return CreateMetricResponse::InvalidPayload(Json(ErrorResponse {
                    error: "'updated_at' must be a valid date (RFC3339)".to_string(),
                }));
            }
        };

        let intensity = match domain::MetricIntensity::from_str(&payload.intensity) {
            Ok(intensity) => intensity,
            Err(error) => {
                let invalid = &payload.intensity;
                error!("failed to map payload 'intensity' to Intensity enum, reason: {error}, invalid value: {invalid:?}");
                return CreateMetricResponse::InvalidPayload(Json(ErrorResponse {
                    error: "invalid 'intensity'".to_string(),
                }));
            }
        };

        let metric = domain::Metric {
            id: id.clone(),
            published_at,
            updated_at,
            symptom_id: payload.symptom_id.to_string(),
            intensity,
            date,
            notes: payload.notes.to_string(),
        };

        match db::create_metric(metric.clone().into(), &context.db_pool).await {
            Ok(()) => (),
            Err(db::DbError::FailedToCreateMetric(reason)) => {
                error!("failed to create metric, reason: {reason}");
                return CreateMetricResponse::OtherError(Json(ErrorResponse { error: reason }));
            }
            Err(_) => unreachable!(),
        };

        info!("metric created: {id}");

        CreateMetricResponse::Success(Json(CreateMetricResponseBody {
            created_metric: metric.into(),
        }))
    }

    /// Retrieve all metrics
    #[oai(path = "/metrics", method = "get")]
    async fn read_all_metrics(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
    ) -> ReadMetricsResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to read metrics, reason: invalid API key");
            return ReadMetricsResponse::InvalidApiKey;
        };

        let db_metrics: Vec<db::Metric> = match db::get_metrics(&context.db_pool, None).await {
            Ok(metrics) => metrics,
            Err(error) => {
                error!("failed to read metrics from DB, reason: {error:?}");
                return ReadMetricsResponse::Success(Json(ReadMetricsResponseBody {
                    metrics: vec![],
                }));
            }
        };

        let mut metrics: Vec<Metric> = vec![];
        let mut error: Option<String> = None;
        for db_metric in db_metrics {
            let domain_metric: domain::Metric = match db_metric.try_into() {
                Ok(metric) => metric,
                Err(reason) => {
                    error = Some(reason);
                    break;
                }
            };
            let api_metric: Metric = domain_metric.into();
            metrics.push(api_metric);
        }

        if error.is_some() {
            error!("failed to read metrics from DB, reason: {error:?}");
            return ReadMetricsResponse::Success(Json(ReadMetricsResponseBody { metrics: vec![] }));
        }

        ReadMetricsResponse::Success(Json(ReadMetricsResponseBody { metrics }))
    }

    /// Update a metric
    #[oai(path = "/metrics/:id", method = "patch")]
    async fn update_metric(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
        id: Path<MetricId>,
        payload: Json<UpdateMetricRequestBody>,
    ) -> UpdateMetricResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to update metric, reason: invalid API key");
            return UpdateMetricResponse::InvalidApiKey;
        };

        let published_at: DateTime<Utc> = chrono::offset::Utc::now();

        let metric_id = id.0;
        let before: domain::Metric = match db::get_metric(metric_id.clone(), &context.db_pool).await
        {
            Ok(db_metric) => {
                let domain_metric: domain::Metric = match db_metric.try_into() {
                    Ok(domain_metric) => domain_metric,
                    Err(reason) => {
                        error!("failed to update metric {metric_id:?}, reason: {reason}");
                        return UpdateMetricResponse::OtherError(Json(ErrorResponse {
                            error: reason,
                        }));
                    }
                };
                domain_metric
            }
            Err(db::DbError::FailedToReadMetric(id, reason)) => {
                error!("failed to update metric {id:?}, reason: {reason}");
                return UpdateMetricResponse::MetricDoesNotExist(Json(ErrorResponse {
                    error: reason,
                }));
            }
            Err(_) => unreachable!(),
        };

        let mut desired = before.clone();
        desired.published_at = published_at;

        if let Some(updated_symptom_id) = payload.symptom_id.clone() {
            desired.symptom_id = updated_symptom_id;
        }

        if let Some(updated_date) = payload.date.clone() {
            desired.date = match DateTime::parse_from_rfc3339(&updated_date) {
                Ok(updated_at) => updated_at.into(),
                Err(error) => {
                    let invalid = &updated_date;
                    error!("failed to map payload 'date' to Datetime<Utc>, reason: {error}, invalid value: {invalid:?}");
                    return UpdateMetricResponse::InvalidPayload(Json(ErrorResponse {
                        error: "'date' must be a valid date (RFC3339)".to_string(),
                    }));
                }
            };
        }

        if let Some(updated_updated_at) = payload.updated_at.clone() {
            desired.updated_at = match DateTime::parse_from_rfc3339(&updated_updated_at) {
                Ok(updated_at) => updated_at.into(),
                Err(error) => {
                    let invalid = &updated_updated_at;
                    error!("failed to map payload 'updated_at' to Datetime<Utc>, reason: {error}, invalid value: {invalid:?}");
                    return UpdateMetricResponse::InvalidPayload(Json(ErrorResponse {
                        error: "'updated_at' must be a valid date (RFC3339)".to_string(),
                    }));
                }
            };
        }

        if let Some(updated_intensity) = payload.intensity.clone() {
            desired.intensity = match domain::MetricIntensity::from_str(&updated_intensity) {
                Ok(intensity) => intensity,
                Err(error) => {
                    let invalid = &updated_intensity;
                    error!("failed to map payload 'intensity' to domain::Intensity, reason: {error}, invalid value: {invalid:?}");
                    return UpdateMetricResponse::InvalidPayload(Json(ErrorResponse {
                        error: "invalid 'intensity'".to_string(),
                    }));
                }
            }
        };

        if let Some(updated_notes) = payload.notes.clone() {
            desired.notes = updated_notes;
        }

        let updated = match db::update_metric(desired.into(), &context.db_pool).await {
            Ok(db_metric) => match domain::Metric::try_from(db_metric) {
                Ok(domain_metric) => domain_metric,
                Err(reason) => {
                    error!("failed to map DB metric to a domain metric, reason: {reason}");
                    return UpdateMetricResponse::OtherError(Json(ErrorResponse {
                        error: SEE_LOGS.to_string(),
                    }));
                }
            },
            Err(db::DbError::FailedToUpdateMetric(id, reason)) => {
                error!("failed to update metric {id}, reason: {reason}");
                return UpdateMetricResponse::OtherError(Json(ErrorResponse { error: reason }));
            }
            Err(_) => unreachable!(),
        };

        let id = &updated.id;
        info!("metric updated: {id}");
        UpdateMetricResponse::Success(Json(UpdateMetricResponseBody {
            updated_metric: updated.into(),
        }))
    }

    /// Delete a metric
    #[oai(path = "/metrics/:id", method = "delete")]
    async fn delete_metric(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
        id: Path<MetricId>,
    ) -> DeleteMetricResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to delete metric, reason: invalid API key");
            return DeleteMetricResponse::InvalidApiKey;
        };

        let id_to_delete = id.0;
        let deleted_id = match db::delete_metric(id_to_delete.clone(), &context.db_pool).await {
            Ok(()) => id_to_delete,
            Err(db::DeleteMetricError::MetricNotFoud(id)) => {
                error!("failed to delete metric {id}, reason: metric not found");
                return DeleteMetricResponse::MetricDoesNotExist(Json(ErrorResponse {
                    error: "metric not found, nothing was deleted".to_string(),
                }));
            }
            Err(db::DeleteMetricError::Other(id, reason)) => {
                error!("failed to delete metric {id}, reason: {reason}");
                return DeleteMetricResponse::OtherError(Json(ErrorResponse { error: reason }));
            }
        };

        info!("metric deleted: {deleted_id}");
        DeleteMetricResponse::Success(Json(DeleteMetricResponseBody {
            deleted_metric: deleted_id,
        }))
    }
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, Utc};

    use crate::{api::metrics::Metric, domain};

    #[test]
    fn api_metric_to_domain_metric() {
        let api_metric = Metric {
            id: "met_aaaaaaaaaa".to_string(),
            symptom_id: "sym_aaaaaaaaaa".to_string(),
            updated_at: "2023-08-07T07:34:55Z".to_string(),
            date: "2023-08-06T00:00:00Z".to_string(),
            intensity: "high".to_string(),
            notes: "a decent note".to_string(),
        };

        let domain_metric = domain::Metric::try_from(api_metric).unwrap();
        assert_eq!(domain_metric.id, "met_aaaaaaaaaa".to_string());
        assert_eq!(domain_metric.symptom_id, "sym_aaaaaaaaaa".to_string());
        let expected_updated_at: DateTime<Utc> =
            DateTime::parse_from_rfc3339("2023-08-07T07:34:55Z")
                .unwrap()
                .into();
        assert_eq!(domain_metric.updated_at, expected_updated_at);
        let expected_date: DateTime<Utc> = DateTime::parse_from_rfc3339("2023-08-06T00:00:00Z")
            .unwrap()
            .into();
        assert_eq!(domain_metric.date, expected_date);
        assert_eq!(domain_metric.intensity, domain::MetricIntensity::High);
        assert_eq!(domain_metric.notes, "a decent note".to_string());
    }

    #[test]
    fn domain_metric_to_api_metric() {
        let domain_metric = domain::Metric {
            id: "met_aaaaaaaaaa".to_string(),
            symptom_id: "sym_aaaaaaaaaa".to_string(),
            updated_at: DateTime::parse_from_rfc3339("2023-08-07T07:34:55Z")
                .unwrap()
                .into(),
            date: DateTime::parse_from_rfc3339("2023-08-06T00:00:00Z")
                .unwrap()
                .into(),
            intensity: domain::MetricIntensity::High,
            notes: "a decent note".to_string(),
        };

        let api_metric: Metric = domain_metric.into();

        assert_eq!(api_metric.id, "met_aaaaaaaaaa".to_string());
        assert_eq!(api_metric.symptom_id, "sym_aaaaaaaaaa".to_string());
        assert_eq!(api_metric.updated_at, "2023-08-07T07:34:55+00:00");
        assert_eq!(api_metric.date, "2023-08-06T00:00:00+00:00");
        assert_eq!(api_metric.intensity, "high".to_string());
        assert_eq!(api_metric.notes, "a decent note".to_string());
    }
}
