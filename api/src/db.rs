use std::str::FromStr;

use crate::domain::{self, DateTimeIsoString, MetricId, MetricNotes, SymptomId, SymptomName};
use chrono::{DateTime, Utc};
use sqlx::Error;
use tracing::{debug, error, info};

pub type DbUrl = String;
pub type DbPool = sqlx::SqlitePool;

type ErrorReason = String;

// Return this error message template when to avoid leaking internal errors to public
// consumers - it's assumed that when using this error message, the actual interal error
// has been sent to logs
const SEE_LOGS: &str = "see logs for further details on error";

#[derive(Debug)]
pub enum DbError {
    // Symptoms
    FailedToCreateSymptom(ErrorReason),
    FailedToReadSymptom(SymptomId, ErrorReason),
    FailedToReadSymptoms(ErrorReason),
    FailedToUpdateSymptom(SymptomId, ErrorReason),
    FailedToUpsertSymptom(SymptomId, ErrorReason),
    // Metrics
    FailedToCreateMetric(ErrorReason),
    FailedToReadMetric(MetricId, ErrorReason),
    FailedToReadMetrics(ErrorReason),
    FailedToUpdateMetric(MetricId, ErrorReason),
    FailedToUpsertMetric(MetricId, ErrorReason),
}

#[derive(Debug)]
pub enum DeleteSymptomError {
    SymptomNotFoud(SymptomId),
    Other(SymptomId, ErrorReason),
}

#[derive(Debug)]
pub enum DeleteMetricError {
    MetricNotFoud(MetricId),
    Other(MetricId, ErrorReason),
}

#[derive(Debug, sqlx::FromRow)]
pub struct Symptom {
    id: SymptomId,
    published_at: String,
    name: SymptomName,
    other_names: String,
    updated_at: String,
}

impl From<domain::Symptom> for Symptom {
    fn from(symptom: domain::Symptom) -> Symptom {
        Symptom {
            id: symptom.id,
            published_at: symptom.published_at.to_rfc3339(),
            name: symptom.name,
            other_names: symptom.other_names.join(","),
            updated_at: symptom.updated_at.to_rfc3339(),
        }
    }
}

// db -> domain
impl TryFrom<Symptom> for domain::Symptom {
    type Error = String;

    fn try_from(db_symptom: Symptom) -> Result<domain::Symptom, Self::Error> {
        let published_at = match DateTime::parse_from_rfc3339(&db_symptom.published_at) {
            Ok(published_at) => published_at.into(),
            Err(_) => {
                let invalid = &db_symptom.published_at;
                return Err(format!(
                    "failed to parse Symptom.published_at string into DateTime<Utc>, invalid value: {invalid}"
                ));
            }
        };

        let updated_at = match DateTime::parse_from_rfc3339(&db_symptom.updated_at) {
            Ok(updated_at) => updated_at.into(),
            Err(_) => {
                let invalid = &db_symptom.updated_at;
                return Err(format!(
                    "failed to parse Symptom.updated_at string into DateTime<Utc>, invalid value: {invalid}"
                ));
            }
        };

        Ok(domain::Symptom {
            id: db_symptom.id,
            published_at,
            name: db_symptom.name,
            other_names: db_symptom
                .other_names
                .split(",")
                .map(|slice| slice.to_string())
                .filter(|name| !name.is_empty())
                .collect::<Vec<String>>(),
            updated_at,
        })
    }
}

#[derive(Clone, Debug, sqlx::FromRow)]
pub struct Metric {
    id: MetricId,
    published_at: DateTimeIsoString,
    pub symptom_id: SymptomId,
    date: DateTimeIsoString,
    updated_at: DateTimeIsoString,
    intensity: String,
    notes: MetricNotes,
}

// domain -> db
impl From<domain::Metric> for Metric {
    fn from(metric: domain::Metric) -> Metric {
        Metric {
            id: metric.id,
            published_at: metric.published_at.to_rfc3339(),
            symptom_id: metric.symptom_id,
            date: metric.date.to_rfc3339(),
            updated_at: metric.updated_at.to_rfc3339(),
            intensity: metric.intensity.to_string(),
            notes: metric.notes,
        }
    }
}

// db -> domain
impl TryFrom<Metric> for domain::Metric {
    type Error = String;

    fn try_from(db_metric: Metric) -> Result<domain::Metric, Self::Error> {
        let published_at = match DateTime::parse_from_rfc3339(&db_metric.published_at) {
            Ok(published_at) => published_at.into(),
            Err(_) => {
                let invalid = &db_metric.published_at;
                return Err(format!(
                    "failed to parse Metric.published_at string into DateTime<Utc>, invalid value: {invalid}"
                ));
            }
        };

        let date = match DateTime::parse_from_rfc3339(&db_metric.date) {
            Ok(date) => date.into(),
            Err(_) => {
                let invalid = &db_metric.date;
                return Err(format!(
                    "failed to parse Metric.date string into DateTime<Utc>, invalid value: {invalid}"
                ));
            }
        };

        let updated_at = match DateTime::parse_from_rfc3339(&db_metric.updated_at) {
            Ok(updated_at) => updated_at.into(),
            Err(_) => {
                let invalid = &db_metric.updated_at;
                return Err(format!(
                    "failed to parse Metric.updated_at string into DateTime<Utc>, invalid value: {invalid}"
                ));
            }
        };

        let intensity = match domain::MetricIntensity::from_str(&db_metric.intensity) {
            Ok(intensity) => intensity,
            Err(error) => return Err(error),
        };

        let domain_metric = domain::Metric {
            id: db_metric.id,
            published_at,
            symptom_id: db_metric.symptom_id,
            date,
            updated_at,
            intensity,
            notes: db_metric.notes,
        };

        Ok(domain_metric)
    }
}

pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::migrate::MigrateError> {
    info!("Running DB migrations...");
    sqlx::migrate!("./migrations").run(pool).await?;
    info!("DB migrations completed");
    Ok(())
}

pub async fn create_symptom(symptom: Symptom, pool: &DbPool) -> Result<(), DbError> {
    match sqlx::query!(
        "INSERT INTO symptoms ( id, published_at, name, other_names, updated_at )
        VALUES ( $1, $2, $3, $4, $5 )",
        symptom.id,
        symptom.published_at,
        symptom.name,
        symptom.other_names,
        symptom.updated_at,
    )
    .execute(pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                error!("failed to create symptom, reason: {result:?}");
                return Err(DbError::FailedToCreateSymptom(SEE_LOGS.to_string()));
            }
            Ok(())
        }
        Err(error) => {
            error!("failed to create symptom, reason: {error:?}");
            Err(DbError::FailedToCreateSymptom(SEE_LOGS.to_string()))
        }
    }
}

pub async fn get_symptom(id: SymptomId, pool: &DbPool) -> Result<Symptom, DbError> {
    match sqlx::query_as!(Symptom, "SELECT * FROM symptoms WHERE id=$1", id)
        .fetch_one(pool)
        .await
    {
        Ok(symptom) => Ok(symptom),
        Err(error) => Err(DbError::FailedToReadSymptom(id, format!("{error:?}"))),
    }
}

pub async fn get_symptoms(
    pool: &DbPool,
    published_since: Option<DateTime<Utc>>,
) -> Result<Vec<Symptom>, DbError> {
    let mut query = String::from("SELECT * FROM symptoms");

    if published_since.is_some() {
        query.push_str(" WHERE published_at > '");
        query.push_str(&published_since.unwrap().to_rfc3339());
        query.push_str("'");
    }

    match sqlx::query_as::<_, Symptom>(&query).fetch_all(pool).await {
        Ok(db_symptoms) => Ok(db_symptoms),
        Err(error) => {
            error!("failed to read symptoms from DB, reason: {error:?}");
            return Err(DbError::FailedToReadSymptoms(SEE_LOGS.to_string()));
        }
    }
}

pub async fn update_symptom(desired: Symptom, pool: &DbPool) -> Result<Symptom, DbError> {
    match sqlx::query!(
        "UPDATE symptoms SET published_at=$1, name=$2, other_names=$3, updated_at=$4 WHERE id=$5",
        desired.published_at,
        desired.name,
        desired.other_names,
        desired.updated_at,
        desired.id,
    )
    .execute(pool)
    .await
    {
        Ok(_) => Ok(desired),
        Err(error) => {
            let id = desired.id;
            error!("failed to update symptom {id}, reason: {error:?}");
            Err(DbError::FailedToUpdateSymptom(id, SEE_LOGS.to_string()))
        }
    }
}

pub async fn delete_symptom(id: SymptomId, pool: &DbPool) -> Result<(), DeleteSymptomError> {
    match sqlx::query!(
        "
        DELETE FROM symptoms WHERE id=$1
        ",
        id,
    )
    .execute(pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                debug!("symptom {id} not found");
                return Err(DeleteSymptomError::SymptomNotFoud(id));
            }
            Ok(())
        }
        Err(error) => {
            let reason = format!("{error:?}");
            error!("failed to delete symptom {id}, reason: {error:?}");
            Err(DeleteSymptomError::Other(id, reason))
        }
    }
}

pub async fn upsert_symptom(desired: Symptom, pool: &DbPool) -> Result<(), DbError> {
    match sqlx::query!(
        "INSERT INTO symptoms ( id, published_at, name, other_names, updated_at )
        VALUES ( $1, $2, $3, $4, $5 )
        ON CONFLICT do UPDATE SET
            published_at=$2,
            name=$3,
            other_names=$4,
            updated_at=$5
        ",
        desired.id,
        desired.published_at,
        desired.name,
        desired.other_names,
        desired.updated_at,
    )
    .execute(pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                error!("failed to upsert symptom, reason: {result:?}");
                return Err(DbError::FailedToUpsertSymptom(
                    desired.id,
                    SEE_LOGS.to_string(),
                ));
            }
            Ok(())
        }
        Err(error) => {
            error!("failed to upsert symptom, reason: {error:?}");
            Err(DbError::FailedToUpsertSymptom(
                desired.id,
                SEE_LOGS.to_string(),
            ))
        }
    }
}

pub async fn create_metric(metric: Metric, pool: &DbPool) -> Result<(), DbError> {
    match sqlx::query!(
        "INSERT INTO metrics ( id, published_at, symptom_id, date, updated_at, intensity, notes )
        VALUES ( $1, $2, $3, $4, $5, $6, $7 )",
        metric.id,
        metric.published_at,
        metric.symptom_id,
        metric.date,
        metric.updated_at,
        metric.intensity,
        metric.notes,
    )
    .execute(pool)
    .await
    {
        Ok(_) => Ok(()),
        Err(error) => {
            error!("failed to create metric, reason: {error:?}\n{metric:?}");
            Err(DbError::FailedToCreateMetric(SEE_LOGS.to_string()))
        }
    }
}

pub async fn get_metric(id: MetricId, pool: &DbPool) -> Result<Metric, DbError> {
    let id = id;
    match sqlx::query_as!(Metric, "SELECT * FROM metrics WHERE id=$1", id)
        .fetch_one(pool)
        .await
    {
        Ok(metric) => Ok(metric),
        Err(Error::RowNotFound) => Err(DbError::FailedToReadMetric(
            id.clone(),
            format!("metric {id} not found"),
        )),
        Err(error) => Err(DbError::FailedToReadMetric(id, format!("{error:?}"))),
    }
}

pub async fn get_metrics(
    pool: &DbPool,
    published_since: Option<DateTime<Utc>>,
) -> Result<Vec<Metric>, DbError> {
    let mut query = String::from("SELECT * FROM metrics");

    if published_since.is_some() {
        query.push_str(" WHERE published_at > '");
        query.push_str(&published_since.unwrap().to_rfc3339());
        query.push_str("'");
    }

    match sqlx::query_as::<_, Metric>(&query).fetch_all(pool).await {
        Ok(metrics) => Ok(metrics),
        Err(error) => {
            error!("failed to get metrics, reason: {error:?}");
            Err(DbError::FailedToReadMetrics(SEE_LOGS.to_string()))
        }
    }
}

pub async fn update_metric(desired: Metric, pool: &DbPool) -> Result<Metric, DbError> {
    match sqlx::query_as!(
        Metric,
        "
        UPDATE metrics
        SET
            published_at=$2,
            symptom_id=$3,
            date=$4,
            updated_at=$5,
            intensity=$6,
            notes=$7
        WHERE id=$1
        RETURNING *
        ",
        desired.id,
        desired.published_at,
        desired.symptom_id,
        desired.date,
        desired.updated_at,
        desired.intensity,
        desired.notes,
    )
    .fetch_one(pool)
    .await
    {
        Ok(updated) => Ok(updated.clone()),
        Err(error) => Err(DbError::FailedToUpdateMetric(
            desired.id,
            format!("{error:?}"),
        )),
    }
}

pub async fn delete_metric(id: MetricId, pool: &DbPool) -> Result<(), DeleteMetricError> {
    match sqlx::query!("DELETE FROM metrics WHERE id=$1", id)
        .execute(pool)
        .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                debug!("metric {id} not found");
                return Err(DeleteMetricError::MetricNotFoud(id));
            }
            Ok(())
        }
        Err(error) => {
            let reason = format!("{error:?}");
            error!("failed to delete metric {id}, reason: {reason:?}");
            Err(DeleteMetricError::Other(id, reason))
        }
    }
}

pub async fn upsert_metric(desired: Metric, pool: &DbPool) -> Result<(), DbError> {
    match sqlx::query!(
        "INSERT INTO metrics ( id, published_at, symptom_id, date, updated_at, intensity, notes )
        VALUES ( $1, $2, $3, $4, $5, $6, $7 )
        ON CONFLICT do UPDATE SET
            published_at=$2,
            symptom_id=$3,
            date=$4,
            updated_at=$5,
            intensity=$6,
            notes=$7
        ",
        desired.id,
        desired.published_at,
        desired.symptom_id,
        desired.date,
        desired.updated_at,
        desired.intensity,
        desired.notes,
    )
    .execute(pool)
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                error!("failed to upsert metric, reason: {result:?}");
                return Err(DbError::FailedToUpsertMetric(
                    desired.id,
                    SEE_LOGS.to_string(),
                ));
            }
            Ok(())
        }
        Err(error) => {
            error!("failed to upsert metric, reason: {error:?}");
            Err(DbError::FailedToUpsertMetric(
                desired.id,
                SEE_LOGS.to_string(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{api::symptoms::Symptom, db, domain};
    use sqlx::SqlitePool;

    // #[tokio::test]
    // async fn create_symptom_and_read() {
    //     let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    //     db::run_migrations(&pool)
    //         .await
    //         .expect("failed to run DB migrations");

    //     let id = "sym_aaaaaaaaaa".to_string();
    //     let symptom = Symptom {
    //         id: id.clone(),
    //         name: "symptom A".to_string(),
    //         other_names: [].to_vec(),
    //     };

    //     match db::create_symptom(symptom.clone(), &pool).await {
    //         Ok(()) => assert!(true),
    //         Err(error) => assert!(false, "failed to create symptom, reason: {error:?}"),
    //     }

    //     let db_symptom = match db::get_symptom(id.clone(), &pool).await {
    //         Ok(s) => s,
    //         Err(error) => {
    //             return assert!(false, "failed to read symptom from DB, reason: {error:?}")
    //         }
    //     };

    //     assert_eq!(symptom, db_symptom);

    //     let db_symptoms = match db::get_symptoms(&pool).await {
    //         Ok(s) => s,
    //         Err(error) => {
    //             return assert!(false, "failed to read symptoms from DB, reason: {error:?}")
    //         }
    //     };

    //     assert_eq!(db_symptoms.len(), 1);
    //     assert_eq!(db_symptoms[0], db_symptom);

    //     let desired = Symptom {
    //         id: id.clone(),
    //         name: "fooo".to_string(),
    //         other_names: vec!["uli!".to_string()],
    //     };

    //     let updated = match db::update_symptom(desired.clone(), &pool).await {
    //         Ok(s) => s,
    //         Err(error) => {
    //             return assert!(false, "failed to update symptom in DB, reason: {error:?}")
    //         }
    //     };

    //     assert_eq!(updated.id, desired.id);
    //     assert_eq!(updated.name, "fooo".to_string());
    //     assert_eq!(updated.other_names, desired.other_names);

    //     match db::delete_symptom(id, &pool).await {
    //         Ok(()) => (),
    //         Err(error) => {
    //             return assert!(false, "failed to update symptom in DB, reason: {error:?}")
    //         }
    //     }
    // }

    // #[tokio::test]
    // async fn create_metric_and_read() {
    //     let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    //     db::run_migrations(&pool)
    //         .await
    //         .expect("failed to run DB migrations");

    //     let symptom_id = "sym_aaaaaaaaaa".to_string();
    //     let symptom = Symptom {
    //         id: symptom_id.clone(),
    //         name: "symptom A".to_string(),
    //         other_names: [].to_vec(),
    //     };

    //     db::create_symptom(symptom.clone(), &pool)
    //         .await
    //         .expect("test setup error: failed to create symptom");

    //     let id = "met_aaaaaaaaaa".to_string();

    //     let metric = db::Metric {
    //         id: id.clone(),
    //         symptom_id: symptom_id.clone(),
    //         date: "2023-08-06T13:25:46+01:00".to_string(),
    //         updated_at: "2023-08-06T13:25:46+01:00".to_string(),
    //     };

    //     match db::create_metric(metric.clone(), &pool).await {
    //         Ok(()) => assert!(true),
    //         Err(error) => assert!(false, "failed to create symptom, reason: {error:?}"),
    //     }
    // }

    #[test]
    fn db_symptom_to_domain_symptom() {
        let db_symptom = db::Symptom {
            id: "sym_aaaaaaaaaa".to_string(),
            name: "symptom A".to_string(),
            other_names: "symptom A name b,symptom A name c".to_string(),
            updated_at: "2023-08-07T07:34:55+01:00".to_string(),
        };

        let domain_symptom: domain::Symptom = db_symptom.into();
        assert_eq!(domain_symptom.id, "sym_aaaaaaaaaa".to_string());
        assert_eq!(domain_symptom.name, "symptom A".to_string());
        assert_eq!(
            domain_symptom.other_names,
            vec![
                "symptom A name b".to_string(),
                "symptom A name c".to_string()
            ]
        );
    }
}
