use std::env;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

use serde::Deserialize;
use tracing::{debug, info, warn};

use crate::db::DbUrl;

const CONFIG_PATH: &str = ".config/health-tracker/config.yaml";

type NumberEnvVar = i64;
type ApiPort = NumberEnvVar;
type ApiHostname = String; // e.g.: "http://0.0.0.0", or "https://foo.bar/health-tracker"
type ApiToken = String;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: DbUrl,

    /// Port at which the API is listening
    pub api_port: ApiPort,

    pub enable_swagger_ui: bool,

    /// Base URL used in the Swagger UI to talk to the API. This value depends on where
    /// the API is running:
    /// - if API is running locally in a container and exposed at the port 1234, then
    ///   `api_hostname` must be `http://localhost:1234` regardless of `api_port`'s
    ///   value. Remember that `api_port` refers to the port at which the API listents
    ///   **inside the container**, nothing to do with the port at which this is exposed
    ///   outside the container.
    /// - if the API is exposed at the domain `https://foo.bar/subpath` then the
    ///   `api_hostname` must be `https://foo.bar/subpath`
    pub api_hostname: ApiHostname,

    pub api_token: ApiToken,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ConfigFile {
    pub database_url: Option<DbUrl>,
    pub api_port: Option<ApiPort>,
    pub enable_swagger_ui: Option<bool>,
    pub api_hostname: Option<ApiHostname>,
    pub api_token: Option<ApiToken>,
}

type EnvironmentVariableName = String;
type ErrorReason = String;

#[derive(Debug)]
pub struct Error {
    pub reason: ErrorReason,
}

#[derive(Debug)]
pub enum EnvError {
    MissingEnvironmentVariable(EnvironmentVariableName),
    UnsupportedEnvironmentVariableValue(ErrorReason),
}

#[derive(Debug)]
pub enum ConfigError {
    HomeNotFound,
    ConfigFileNotFound(PathBuf),
    ConfigFileHasUnsupportedFormat(ErrorReason),
}

fn load_config_from_user_config_file() -> Result<ConfigFile, ConfigError> {
    let home_str = match std::env::var("HOME") {
        Ok(home) => home,
        Err(error) => {
            debug!("could not find HOME environment variable, reason: {error:?}");
            return Err(ConfigError::HomeNotFound);
        }
    };

    let home = Path::new(&home_str);
    let path = home.join(CONFIG_PATH.to_string());

    if path.exists() == false {
        return Err(ConfigError::ConfigFileNotFound(path));
    }

    let content = fs::read_to_string(&path).unwrap();

    match serde_yaml::from_str::<ConfigFile>(&content) {
        Ok(config_file) => Ok(config_file),
        Err(error) => {
            debug!("failed to parse config file, reason: {error:?}");
            return Err(ConfigError::ConfigFileHasUnsupportedFormat(
                error.to_string(),
            ));
        }
    }
}

#[derive(Debug)]
pub enum StringEnvVarError {
    MissingEnvironmentVariable(EnvironmentVariableName),
}

fn get_string_from_env_var(key: &str) -> Result<String, StringEnvVarError> {
    let raw = match env::var(&key) {
        Ok(value) => value,
        Err(_) => {
            return Err(StringEnvVarError::MissingEnvironmentVariable(
                key.to_string(),
            ))
        }
    };

    Ok(raw)
}

fn get_integer_from_env_var(key: &str) -> Result<NumberEnvVar, EnvError> {
    let raw = match env::var(&key) {
        Ok(value) => value,
        Err(_) => return Err(EnvError::MissingEnvironmentVariable(key.to_string())),
    };

    let value = match raw.parse::<NumberEnvVar>() {
        Ok(value) => value,
        Err(_) => return Err(EnvError::UnsupportedEnvironmentVariableValue(raw)),
    };

    Ok(value)
}

fn get_boolean_from_env_var(key: &str) -> Result<bool, EnvError> {
    let raw = match env::var(&key) {
        Ok(value) => value,
        Err(_) => return Err(EnvError::MissingEnvironmentVariable(key.to_string())),
    };

    let value = match raw.to_lowercase().as_ref() {
        "y" => true,
        "yes" => true,
        "true" => true,
        "n" => false,
        "no" => false,
        "false" => false,
        _ => return Err(EnvError::UnsupportedEnvironmentVariableValue(raw)),
    };

    Ok(value)
}

pub fn get_config() -> Result<Config, Error> {
    // first try to load from config file
    let config_file = match load_config_from_user_config_file() {
        Ok(config) => Some(config),
        Err(reason) => {
            let reason = match reason {
                ConfigError::HomeNotFound => format!("HOME not found"),
                ConfigError::ConfigFileNotFound(expected_path) => {
                    format!("expected file at {expected_path:?}, but it does not exist")
                }
                ConfigError::ConfigFileHasUnsupportedFormat(parse_failure) => {
                    format!("failed to parse because {parse_failure}")
                }
            };
            info!("config file not loaded, reason: {reason}");
            None
        }
    };

    // then, check if env_vars are set, and overrides values
    // if a field is not present in config file nor envvar, then fail
    let database_url = match get_string_from_env_var("DATABASE_URL") {
        Ok(url) => url,
        Err(StringEnvVarError::MissingEnvironmentVariable(env_var_name)) => {
            let api_url_not_set = format!( "health-tracker database URL is not set, please add it to ~/{CONFIG_PATH} or as {env_var_name}");

            if config_file.is_none() {
                return Err(Error {
                    reason: api_url_not_set,
                });
            }

            match config_file.clone().unwrap().database_url {
                Some(url_str) => url_str,
                None => {
                    return Err(Error {
                        reason: api_url_not_set,
                    })
                }
            }
        }
    };

    let api_port = match get_integer_from_env_var("API_PORT") {
        Ok(port) => port,
        Err(EnvError::MissingEnvironmentVariable(env_var_name)) => {
            let api_port_not_set = format!("health-tracker API port is not set, please add it to ~/{CONFIG_PATH} or as {env_var_name}");

            if config_file.is_none() {
                return Err(Error {
                    reason: api_port_not_set,
                });
            }

            match config_file.clone().unwrap().api_port {
                Some(port) => port,
                None => {
                    return Err(Error {
                        reason: api_port_not_set,
                    })
                }
            }
        }
        Err(EnvError::UnsupportedEnvironmentVariableValue(unsupported_value)) => {
            if config_file.is_none() {
                return Err(Error {
                    reason: format!(
                        "expected API_PORT to be a number, but got {unsupported_value} instead"
                    ),
                });
            }

            match config_file.clone().unwrap().api_port {
                Some(port) => {
                    warn!("unsupported value passed via API_PORT environment variable ({unsupported_value}), falling back to value in config file");
                    port
                }
                None => {
                    return Err(Error {
                        reason: format!(
                            "expected API_PORT to be a number, but got {unsupported_value} instead"
                        ),
                    })
                }
            }
        }
    };

    let enable_swagger_ui = match get_boolean_from_env_var("ENABLE_SWAGGER_UI") {
        Ok(bool) => bool,
        // If nothing is specified, default to `false`
        Err(EnvError::MissingEnvironmentVariable(_)) => config_file
            .as_ref()
            .map_or(false, |config| config.enable_swagger_ui.unwrap_or(false)),
        Err(EnvError::UnsupportedEnvironmentVariableValue(env_var_name)) => {
            return Err(Error {
                reason: format!("environment variable {env_var_name} has an unsupported value "),
            });
        }
    };

    let api_hostname = match get_string_from_env_var("API_HOSTNAME") {
        Ok(url) => url,
        Err(StringEnvVarError::MissingEnvironmentVariable(env_var_name)) => {
            let api_hostname_not_set = format!("health-tracker hostname is not set, please add it to ~/{CONFIG_PATH} or as {env_var_name}");

            if config_file.is_none() {
                return Err(Error {
                    reason: api_hostname_not_set,
                });
            }

            match config_file.clone().unwrap().api_hostname {
                Some(url_str) => url_str,
                None => {
                    return Err(Error {
                        reason: api_hostname_not_set,
                    })
                }
            }
        }
    };

    let api_token = match get_string_from_env_var("API_TOKEN") {
        Ok(token) => {
            if token.is_empty() {
                return Err(Error {
                    reason: format!(
                        "health-tracker API token is an empty string, please use a valid API token"
                    ),
                });
            }
            token
        }
        Err(StringEnvVarError::MissingEnvironmentVariable(env_var_name)) => {
            let api_token_not_set = format!("health-tracker API token is not set, please add it to ~/{CONFIG_PATH} or as {env_var_name}");

            if config_file.is_none() {
                return Err(Error {
                    reason: api_token_not_set,
                });
            }

            match config_file.clone().unwrap().api_token {
                Some(token) => token,
                None => {
                    return Err(Error {
                        reason: api_token_not_set,
                    })
                }
            }
        }
    };

    let config = Config {
        database_url,
        api_port,
        enable_swagger_ui,
        api_hostname,
        api_token,
    };

    Ok(config)
}
