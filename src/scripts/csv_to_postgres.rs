use std::time::Instant;

use crate::domain::repositories::movie_repository::MovieRepository;
use crate::infrastructure::{
    csv::repositories::csv_movie_repository::CsvMovieRepository,
    postgres::{self, repositories::postgres_movie_repository::PostgresMovieRepository},
};

pub async fn run(csv_path: &str) {
    let started = Instant::now();

    let csv_repo = CsvMovieRepository::from_csv_file(csv_path);
    let movies = csv_repo
        .find_all()
        .await
        .expect("failed to read movies from csv");
    let total = movies.len();

    println!("Loaded {total} movies from {csv_path}");

    let pool = postgres::postgres::initialize_database().await;
    let postgres_repo = PostgresMovieRepository::new(pool);

    let mut inserted = 0usize;
    let mut skipped = 0usize;
    let mut failed = 0usize;

    for (position, movie) in movies.into_iter().enumerate() {
        let id = movie.id;

        match postgres_repo.find_by_id(id).await {
            Ok(Some(_)) => {
                skipped += 1;
                continue;
            }
            Ok(None) => {}
            Err(error) => {
                failed += 1;
                eprintln!("failed to check movie {id}: {error}");
                continue;
            }
        }

        if let Err(error) = postgres_repo.create(movie).await {
            failed += 1;
            eprintln!("failed to insert movie {id}: {error}");
        } else {
            inserted += 1;
        }

        if (position + 1) % 250 == 0 {
            println!("...processed {}/{total}", position + 1);
        }
    }

    println!(
        "Done in {:.1}s — inserted {inserted}, skipped {skipped}, failed {failed}",
        started.elapsed().as_secs_f64()
    );
}
