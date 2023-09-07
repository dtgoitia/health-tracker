use poem_openapi::{auth::ApiKey, SecurityScheme};

use crate::config::Config;

#[derive(SecurityScheme)]
#[oai(ty = "api_key", key_name = "x-api-key", key_in = "header")]
pub struct ApiKeyAuth(ApiKey);

pub fn validate_api_key(auth: ApiKeyAuth, config: &Config) -> Result<(), ()> {
    let api_key = auth.0.key;

    if config.api_token != api_key {
        return Err(());
    }
    Ok(())
}
