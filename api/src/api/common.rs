use poem_openapi::Tags;

// Return this error message template when to avoid leaking internal errors to public
// consumers - it's assumed that when using this error message, the actual interal error
// has been sent to logs
pub const SEE_LOGS: &str = "see logs for further details on error";

#[derive(Tags)]
pub enum ApiTags {
    All,
    Symptoms,
    Metrics,
}
