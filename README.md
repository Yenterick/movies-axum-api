<p align="center">
    <img src="./docs/banner.png" alt="banner"/>
</p>

<p align="center">
    <img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white" alt="Rust"/>
    <img src="https://img.shields.io/badge/Axum-2D2D2D?logo=rust&logoColor=white" alt="Axum"/>
    <img src="https://img.shields.io/badge/Tokio-7E57C2?logo=tokio&logoColor=white" alt="Tokio"/>
    <img src="https://img.shields.io/badge/Serde-000000?logo=rust&logoColor=white" alt="Serde"/>
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"/>
</p>

<p align="center">
    A RESTful API built with Rust and Axum for querying CSV data over a local HTTPS connection.
</p>

---

## Database Diagram

```mermaid
erDiagram
    MOVIE ||--o{ MOVIE_GENRE : has
    GENRE ||--o{ MOVIE_GENRE : belongs

    MOVIE ||--o{ MOVIE_KEYWORD : has
    KEYWORD ||--o{ MOVIE_KEYWORD : belongs

    MOVIE ||--o{ MOVIE_PRODUCTION_COMPANY : has
    PRODUCTION_COMPANY ||--o{ MOVIE_PRODUCTION_COMPANY : belongs

    MOVIE ||--o{ MOVIE_PRODUCTION_COUNTRY : has
    PRODUCTION_COUNTRY ||--o{ MOVIE_PRODUCTION_COUNTRY : belongs

    MOVIE ||--o{ MOVIE_SPOKEN_LANGUAGE : has
    SPOKEN_LANGUAGE ||--o{ MOVIE_SPOKEN_LANGUAGE : belongs

    MOVIE ||--o{ MOVIE_CAST : has
    PERSON ||--o{ MOVIE_CAST : plays

    MOVIE ||--o{ MOVIE_CREW : has
    PERSON ||--o{ MOVIE_CREW : works

    MOVIE {
        BIGINT id
        BIGINT index
        BIGINT budget
        TEXT homepage
        VARCHAR(100) original_Language
        TEXT original_title
        TEXT overview
        DOUBLE popularity
        DATE release_date
        BIGINT revenue
        PRECISION runtime
        VARCHAR(100) status
        TEXT tagline
        TEXT title
        DOUBLE vote_average
        BIGINT vote_count
    }

    GENRE {
        SERIAL id
        VARCHAR(200) name 
    }

    MOVIE_GENRE {
        BIGINT movie_id
        INT keyword_id
    }

    KEYWORD {
        SERIAL id
        VARCHAR(255) name
    }

    MOVIE_KEYWORD {
        BIGINT movie_id
        INT keyword_id
    }

    PRODUCTION_COMPANY {
        BIGINT id
        VARCHAR(255) name
    }

    MOVIE_PRODUCTION_COMPANY {
        BIGINT movie_id
        BIGINT company_id
    }

    PRODUCTION_COUNTRY {
        VARCHAR(10) iso_3166_1
        VARCHAR(255) name
    }

    MOVIE_PRODUCTION_COUNTRY {
        BIGINT movie_id
        VARCHAR(10) country_iso
    }
    
    SPOKEN_LANGUAGE {
        VARCHAR(10) iso_639_1
        VARCHAR(255) name
    }

    MOVIE_SPOKEN_LANGUAGE {
        VARCHAR(10) iso_639_1
        VARCHAR(255) name
    }

    PERSON {
        BIGINT id
        VARCHAR(255) name
        INT gender
    }

    MOVIE_CAST   {
        BIGINT movie_id
        BIGINT person_id
    }

    MOVIE_CREW {
        VARCHAR(100) credit_id
        BIGINT movie_id
        BIGINT person_id
        VARCHAR(255) department
        VARCHAR(255) job
    }
```

---

## License

This project is licensed under the [MIT License](./LICENSE).

## Author

* [Yenterick](https://github.com/Yenterick)
