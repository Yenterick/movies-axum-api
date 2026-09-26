use sqlx::{PgPool, postgres::PgPoolOptions};

pub async fn initialize_database() -> PgPool {
    let _ = dotenv::dotenv();

    let db_url: String =
        std::env::var("DATABASE_URL").expect("DATABASE_URL environment variable must be set!");

    PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await
        .expect("Failed to connect to PostgreSQL")
}
