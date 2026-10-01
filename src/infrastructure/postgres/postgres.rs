use sqlx::{PgPool, postgres::PgPoolOptions};

pub async fn initialize_database() -> PgPool {
    let db_url: String =
        std::env::var("DATABASE_URL").expect("DATABASE_URL environment variable must be set!");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run database migrations");

    pool
}
