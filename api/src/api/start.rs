use crate::{
    config::Config,
    db::{self, DbPool},
};
use poem::{
    listener::TcpListener,
    middleware::{Cors, CorsEndpoint},
    EndpointExt, Route, Server,
};
use poem_openapi::{payload::PlainText, OpenApi, OpenApiService};
use tracing::info;

use super::{all, metrics, symptoms};

pub struct HealthEndpoint {}
type ApiDocsUrl = String;

#[OpenApi]
impl HealthEndpoint {
    /// Service health endpoint
    #[oai(path = "/health", method = "get")]
    async fn health(&self) -> PlainText<&str> {
        // TODO: check against DB too - https://tjmaynes.com/posts/implementing-the-health-check-api-pattern-with-rust/
        PlainText("")
    }
}

#[derive(Clone)]
pub struct ApiContext {
    pub db_pool: DbPool,
    pub config: Config,
}

pub fn get_api(
    db: DbPool,
    config: Config,
) -> (
    poem::middleware::AddDataEndpoint<CorsEndpoint<Route>, ApiContext>,
    ApiDocsUrl,
) {
    let endpoints = (
        HealthEndpoint {},
        symptoms::Endpoints {},
        metrics::Endpoints {},
        all::Endpoints {},
    );

    let service =
        OpenApiService::new(endpoints, "Hello World", "1.0").server(config.api_hostname.clone());
    let docs = service.swagger_ui();

    let mut app_route = Route::new().nest("/", service);
    if config.enable_swagger_ui {
        app_route = app_route.nest("/docs", docs);
    }

    let context = ApiContext {
        db_pool: db,
        config: config.clone(),
    };
    let app = app_route.with(Cors::new()).data(context);

    let api_docs_url = format!("{}/docs", config.api_hostname);

    (app, api_docs_url)
}

pub async fn start_server(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let db = DbPool::connect(&config.database_url).await?;
    db::run_migrations(&db).await?;

    let port = config.api_port;
    let address = format!("0.0.0.0:{port}");

    let (app, api_docs_url) = get_api(db, config.clone());

    if config.enable_swagger_ui {
        info!("API docs: {api_docs_url}");
    }
    info!("Starting server...");

    Server::new(TcpListener::bind(address)).run(app).await?;

    Ok(())
}
