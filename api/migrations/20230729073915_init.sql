CREATE TABLE IF NOT EXISTS symptoms (
    id            TEXT PRIMARY KEY NOT NULL UNIQUE,
    published_at  TEXT             NOT NULL,
    name          TEXT             NOT NULL,
    other_names   TEXT             NOT NULL,
    updated_at    TEXT             NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
    id            TEXT PRIMARY KEY NOT NULL UNIQUE,
    published_at  TEXT             NOT NULL,
    symptom_id    TEXT             NOT NULL,
    date          TEXT             NOT NULL,
    updated_at    TEXT             NOT NULL,
    intensity     TEXT             NOT NULL,
    notes         TEXT             NOT NULL,
    FOREIGN KEY(symptom_id) REFERENCES symptoms(id)
);

PRAGMA foreign_keys = ON;
