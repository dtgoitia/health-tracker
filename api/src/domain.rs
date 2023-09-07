use std::fmt::Display;

use crate::ids;
use chrono::{DateTime, Utc};

pub type DateTimeIsoString = String; // "2023-08-05T18:09:06+01:00"
pub type SymptomId = String;
pub type SymptomName = String;
pub type SymptomOtherNames = Vec<SymptomName>;

#[derive(Clone, Debug)]
pub struct Symptom {
    pub id: SymptomId,
    /// when the symptom was last updated in the server
    pub published_at: DateTime<Utc>,
    pub name: SymptomName,
    pub other_names: SymptomOtherNames,
    /// when the symptom was last updated in a client
    pub updated_at: DateTime<Utc>,
}

pub type MetricId = String;
pub type MetricNotes = String;

#[derive(Clone, Debug)]
pub struct Metric {
    pub id: MetricId,
    /// when the metric was last updated in the server
    pub published_at: DateTime<Utc>,
    pub symptom_id: SymptomId,
    pub date: DateTime<Utc>,
    /// when the metric was last updated in a client
    pub updated_at: DateTime<Utc>,
    pub intensity: MetricIntensity,
    pub notes: MetricNotes,
}

#[derive(Clone, Debug, PartialEq)]
pub enum MetricIntensity {
    Low,
    Medium,
    High,
}

impl Display for MetricIntensity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let as_string = format!("{self:?}").to_lowercase();
        write!(f, "{as_string}")
    }
}

pub fn generate_symptom_id() -> SymptomId {
    ids::generate_id("sym".to_string())
}

pub fn generate_metric_id() -> MetricId {
    ids::generate_id("met".to_string())
}
