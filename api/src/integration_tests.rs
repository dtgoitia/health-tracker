#[cfg(test)]
mod tests {
    use poem::test::TestClient;
    use sqlx::SqlitePool;

    use crate::{api, db};

    #[tokio::test]
    async fn create_symptom_and_read() {
        let db = SqlitePool::connect("sqlite::memory:").await.unwrap();
        db::run_migrations(&db)
            .await
            .expect("failed to run DB migrations");

        let api = api::start::get_api(db);

        let client = TestClient::new(api);
        let response = client.get("/api/symptoms").send().await;
        let body = response.json().await;
        let body_value = body.value();
        body_value.object().get("symptoms").array().assert_len(0);
        let kk = body_value.object();
        println!("{kk:?}");

        assert!(true, "fooo")
    }
}
