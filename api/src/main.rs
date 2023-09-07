use std::process;

use config::Config;
use tracing::{error, info};
use tracing_subscriber;

mod api;
mod config;
mod db;
mod domain;
mod ids;
mod integration_tests;

async fn amain(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    api::start::start_server(config).await?;
    Ok(())
}

fn exit_with_error(message: String) -> () {
    println!("ERROR: {}", message);
    process::exit(1);
}

fn main() -> () {
    tracing_subscriber::fmt::init();

    info!("Loading config...");
    let config = match config::get_config() {
        Ok(config) => config,
        Err(error) => {
            return exit_with_error(error.reason);
        }
    };
    let db_url = config.database_url.clone();
    info!("DB_URL={db_url}");

    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        match amain(config).await {
            Ok(result) => info!("Server successfully stopped: {result:?}"),
            Err(error) => error!("{error:?}"),
        }
    })
}
