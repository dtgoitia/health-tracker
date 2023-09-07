use chrono::{DateTime, Utc};
use poem::web::Data;
use poem_openapi::{param::Query, payload::Json, ApiResponse, Object, OpenApi};
use tracing::{debug, error, warn};

use crate::{
    api::{
        common::{ApiTags, SEE_LOGS},
        error::ErrorResponse,
        security::validate_api_key,
    },
    db::{self},
    domain::{self, MetricId, SymptomId},
};

use super::{
    metrics::{api_metric_to_domain, Metric},
    security::ApiKeyAuth,
    start::ApiContext,
    symptoms::{api_symptom_to_domain, Symptom},
};

pub struct Endpoints {}

#[derive(Object, Debug, Clone)]
struct PushAll {
    symptoms: Vec<Symptom>,
    metrics: Vec<Metric>,
}

#[derive(ApiResponse)]
enum ReadAllResponse {
    /// All symptoms and metrics successfuly read
    #[oai(status = 200)]
    Success(Json<ReadAllResponseBody>),

    /// Invalid request
    #[oai(status = 400)]
    InvalidRequest(Json<ErrorResponse>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,

    /// Valid request, but could not process some reason
    #[oai(status = 422)]
    OtherError(Json<ErrorResponse>),
}

#[derive(Object, Debug)]
struct ReadAllResponseBody {
    symptoms: Vec<Symptom>,
    metrics: Vec<Metric>,
}

#[derive(ApiResponse)]
enum PushAllResponse {
    /// All symptoms and metrics successfuly received
    #[oai(status = 200)]
    Success(Json<PushAllResponseBody>),

    /// Invalid API token
    #[oai(status = 401)]
    InvalidApiKey,
}

#[derive(Object, Debug)]
struct PushAllSymptomsResponseBody {
    successful: Vec<SymptomId>,
    failed: Vec<SymptomId>,
}

#[derive(Object, Debug)]
struct PushAllMetricsResponseBody {
    successful: Vec<MetricId>,
    failed: Vec<MetricId>,
}

#[derive(Object, Debug)]
struct PushAllResponseBody {
    symptoms: PushAllSymptomsResponseBody,
    metrics: PushAllMetricsResponseBody,
}

#[OpenApi(tag = "ApiTags::All")]
impl Endpoints {
    /// Retrieve all symptoms and metrics
    #[oai(path = "/get-all", method = "get")]
    async fn read_all(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,

        /// Instant at which the data arrived to the server - which is different
        /// to the instant at which the data was updated in the client.
        published_since: Query<Option<String>>,
    ) -> ReadAllResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to read all, reason: invalid API key");
            return ReadAllResponse::InvalidApiKey;
        };

        let published_since_date: Option<DateTime<Utc>> = match published_since.0 {
            Some(raw) => match DateTime::parse_from_rfc3339(&raw) {
                Ok(date) => Some(date.into()),
                Err(reason) => {
                    error!("failed to parse `published_since` URL query parameter into a date, reason: {reason:?}");
                    return ReadAllResponse::InvalidRequest(Json(ErrorResponse {
                        error: "'updated_at' must be a valid date (RFC3339)".to_string(),
                    }));
                }
            },
            None => None,
        };
        debug!("fetching changes published after {published_since_date:?}");

        // Gather symptoms
        let db_symptoms: Vec<db::Symptom> =
            match db::get_symptoms(&context.db_pool, published_since_date).await {
                Ok(symptoms) => symptoms,
                Err(reason) => {
                    error!("failed to read symptoms from DB, reason: {reason:?}");
                    return ReadAllResponse::OtherError(Json(ErrorResponse {
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
            return ReadAllResponse::OtherError(Json(ErrorResponse {
                error: SEE_LOGS.to_string(),
            }));
        }

        // Gather metrics
        let db_metrics: Vec<db::Metric> =
            match db::get_metrics(&context.db_pool, published_since_date).await {
                Ok(metrics) => metrics,
                Err(reason) => {
                    error!("failed to read metrics from DB, reason: {reason:?}");
                    return ReadAllResponse::OtherError(Json(ErrorResponse {
                        error: SEE_LOGS.to_string(),
                    }));
                }
            };

        let mut metrics: Vec<Metric> = vec![];
        let mut metrics_error: Option<String> = None;
        for db_metric in db_metrics {
            let domain_metric: domain::Metric = match db_metric.try_into() {
                Ok(metric) => metric,
                Err(reason) => {
                    metrics_error = Some(reason);
                    break;
                }
            };
            let api_metric: Metric = domain_metric.into();
            metrics.push(api_metric);
        }

        if metrics_error.is_some() {
            error!("failed to read metrics from DB, reason: {metrics_error:?}");
            return ReadAllResponse::OtherError(Json(ErrorResponse {
                error: SEE_LOGS.to_string(),
            }));
        }

        return ReadAllResponse::Success(Json(ReadAllResponseBody { symptoms, metrics }));
    }

    /// Retrieve all symptoms
    #[oai(path = "/push-all", method = "post")]
    async fn push_all(
        &self,
        auth: ApiKeyAuth,
        context: Data<&ApiContext>,
        payload: Json<PushAll>,
    ) -> PushAllResponse {
        if validate_api_key(auth, &context.config).is_err() {
            warn!("failed to read all, reason: invalid API key");
            return PushAllResponse::InvalidApiKey;
        };

        let published_at: DateTime<Utc> = chrono::offset::Utc::now();
        let mut successful_symptoms: Vec<SymptomId> = vec![];
        let mut failed_symptoms: Vec<SymptomId> = vec![];
        let mut successful_metrics: Vec<MetricId> = vec![];
        let mut failed_metrics: Vec<MetricId> = vec![];

        for api_symptom in payload.symptoms.clone().into_iter() {
            let id = api_symptom.clone().id;
            let result = api_symptom_to_domain(api_symptom, published_at);
            if result.is_err() {
                error!("failed to convert into domain::Symptom, SymptomID={id}");
                failed_symptoms.push(id);
                continue;
            };

            let symptom = result.unwrap();

            match db::upsert_symptom(symptom.into(), &context.db_pool).await {
                Ok(()) => {
                    successful_symptoms.push(id);
                }
                Err(db::DbError::FailedToUpsertSymptom(_, reason)) => {
                    error!("failed to upsert symptom, reason {reason}");
                    failed_symptoms.push(id);
                }
                Err(_) => unreachable!(),
            }
        }

        for api_metric in payload.metrics.clone().into_iter() {
            let id = api_metric.clone().id;
            let result = api_metric_to_domain(api_metric, published_at);
            if result.is_err() {
                error!("failed to convert into domain::Metric, MetricID={id}");
                failed_metrics.push(id);
                continue;
            };

            let metric = result.unwrap();

            match db::upsert_metric(metric.into(), &context.db_pool).await {
                Ok(()) => {
                    successful_metrics.push(id);
                }
                Err(db::DbError::FailedToUpsertMetric(_, reason)) => {
                    error!("failed to upsert metric, reason {reason}");
                    failed_metrics.push(id);
                }
                Err(_) => unreachable!(),
            }
        }

        PushAllResponse::Success(Json(PushAllResponseBody {
            symptoms: PushAllSymptomsResponseBody {
                successful: successful_symptoms,
                failed: failed_symptoms,
            },
            metrics: PushAllMetricsResponseBody {
                successful: successful_metrics,
                failed: failed_metrics,
            },
        }))
    }
}
