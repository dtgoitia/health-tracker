"""
Read all symptoms and metrics from old records, and merge them into an SQLite DB.

Features:

    - Set all `published_at` to a very old date to easily recognize them if needed.
    - Set the `updated_at` to a very old date if the Symptom/Metric does not have such value

"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import TypeAlias
import csv
import datetime
import sqlite3
import logging
import json
from pathlib import Path

logger = logging.getLogger(__name__)

PAST_DATE = datetime.datetime.fromisoformat("2020-01-01 00:00:00Z")
SymptomId = str
MetricId = str

def get_sqlite_connection(db_path: Path) -> sqlite3.Connection:
    logger.debug(f"Connecting to {db_path.absolute()}")
    connection = sqlite3.connect(str(db_path))
    return connection


@dataclass(frozen=True)
class Symptom:
    id: str
    name: str
    other_names: str
    updated_at: datetime.datetime | None
    published_at: None

    @staticmethod
    def csv_headers() -> list[str]:
        return ['id', 'name', 'other_names', 'updated_at']

    @staticmethod
    def from_dict(d: dict) -> Symptom:
        return Symptom(
            id=d['id'],
            name=d['name'],
            other_names=d['otherNames'],
            updated_at=datetime.datetime.fromisoformat(d['lastModified']) if 'lastModified' in d else PAST_DATE,
            published_at=PAST_DATE,
        )

@dataclass(frozen=True)
class Metric:
    id: str
    date: datetime.datetime
    symptom_id: str
    intensity: str
    notes: str
    updated_at: datetime.datetime | None
    published_at: None

    @staticmethod
    def csv_headers() -> list[str]:
        return ['id', 'date', 'symptom_id', 'intensity', 'notes', 'updated_at']

    @staticmethod
    def from_dict(d: dict) -> Metric:
        return Metric(
            id=d['id'],
            date=datetime.datetime.fromisoformat(d['date']),
            symptom_id=d['symptomId'],
            intensity=d['intensity'],
            notes=d['notes'],
            updated_at=datetime.datetime.fromisoformat(d['lastModified']) if 'lastModified' in d else PAST_DATE,
            published_at=PAST_DATE,
        )

@dataclass(frozen=True)
class JsonBackup:
    path: Path
    date:datetime.datetime  # earliest datetime in backfup records
    symptoms: list[Symptom]
    metrics: list[Metric]

    @staticmethod
    def from_dict(path: Path, d: dict) -> JsonBackup:
        return JsonBackup(
            path=path,
            date=datetime.datetime.fromisoformat(d['date']),
            symptoms=[Symptom.from_dict(s) for s in d['symptoms']],
            metrics=[Metric.from_dict(m) for m in d['history']],
        )


@dataclass(frozen=True)
class Backup:
    symptoms: dict[SymptomId, Symptom]
    metrics: dict[MetricId, Metric]


def _load_json_backup(path: Path) -> JsonBackup:
    raw = path.read_text().strip()
    data = json.loads(raw)
    return JsonBackup.from_dict(path=path, d=data)


def _get_backup_date_range(backup: JsonBackup) -> tuple[datetime.datetime, datetime.datetime]:
    # TODO: raise if there are dates in the future
    earliest: datetime.datetime = None
    latest: datetime.datetime = None

    for metric in backup.metrics:
        if date := metric.date:
            earliest = min(earliest, date) if earliest else date
            latest = max(latest, date) if latest else date

    return earliest, latest


def _get_latest_symptom(existing: Symptom, new: Symptom) -> Symptom:
    if existing.updated_at is None and new.updated_at is None:
        return new

    if existing.updated_at is not None and new.updated_at is None:
        raise Exception("`lastMofified` found in existing symptom but in new symptom")

    if existing.updated_at is None and new.updated_at is not None:
        return new

    if existing.updated_at < new.updated_at:
        return new
    else:
        return existing

def _get_latest_metric(existing: Metric, new: Metric) -> Metric:
    if existing.updated_at is None and new.updated_at is None:
        return new

    if existing.updated_at is not None and new.updated_at is None:
        raise Exception("`lastMofified` found in existing metric but in new metric")

    if existing.updated_at is None and new.updated_at is not None:
        return new

    if existing.updated_at < new.updated_at:
        return new
    else:
        return existing

def _merge_backups(backups: list[JsonBackup]) -> Backup:
    # Index backup files by path to later refer to the backup file content in
    # case it's needed to manually inspect the file content
    backups_by_path: dict[Path, JsonBackup] = {b.path: b for b in backups}

    # Track in which Backups each Symptom appears
    # This can be used to find weird date discrepancies like undesired modifications
    symptom_by_path: dict[SymptomId, list[Path]] = {}
    metrics_by_path: dict[MetricId, list[Path]] = {}
    # symptom_occurrences: dict[SymptomId, list[datetime.datetime]] = {}
    metric_occurrences: dict[MetricId, list[datetime.datetime]] = {}

    for backup in backups:
        for symptom in backup.symptoms:
            # Track in which backups doees the symptom appear
            if symptom.id in symptom_by_path:
                symptom_by_path[symptom.id].append(backup.path)
            else:
                symptom_by_path[symptom.id] = [backup.path]

        for metric in backup.metrics:
            # Track in which backups doees the metric appear
            if metric.id in metrics_by_path:
                metrics_by_path[metric.id].append(backup.path)
            else:
                metrics_by_path[metric.id] = [backup.path]

            # Track in at which times does a metric appear
            if metric.id in metric_occurrences:
                metric_occurrences[metric.id].append(metric.date)
            else:
                metric_occurrences[metric.id] = [metric.date]

    # Find out any metric that shows different dates across backups
    for metric_id, occurrence_dates in metric_occurrences.items():
        if len(set(occurrence_dates)) > 1:
            raise Exception(
                "\n".join(
                    [
                        f"the metric {metric_id!r} has these different dates across backups:",
                        *[f'  - {date} ' for date in occurrence_dates],
                    ]
                )
            )

    # Final merged symptoms
    symptoms = {}
    metrics = {}

    last_backup: None | datetime.datetime = None
    for backup in backups:
        if last_backup and backup.date < last_backup:
            raise Exception("Expected backups to be traversed in chronological order")
        last_backup = backup.date

        earliest, latest = _get_backup_date_range(backup=backup)

        # Fail if there are records in the backup that contain future values
        if backup.date + datetime.timedelta(seconds=1) < latest:
            raise Exception(
                f"backup {backup.date} has metrics in the future:\n"
                f"latest metric: {latest}\n"
                f"backup date:   {backup.date}"
            )

        for symptom in backup.symptoms:
            if previous := symptoms.get(symptom.id):
                symptoms[symptom.id] = _get_latest_symptom(existing=previous, new=symptom)
                previous = None
            else:
                symptoms[symptom.id] = symptom

        for metric in backup.metrics:
            if previous := metrics.get(metric.id):
                metrics[metric.id] = _get_latest_metric(existing=previous, new=metric)
                previous = None
            else:
                metrics[metric.id] = metric

    return Backup(symptoms=symptoms, metrics=metrics)


def _clone_truncated_db(to: Path) -> None:
    truncated = Path('/home/dtg/projects/health-tracker/empty.sqlite')
    to.write_bytes(truncated.read_bytes())


def _write_symptom(connection: sqlite3.Connection, symptom: Symptom) -> None:
    query = f"""
    INSERT INTO symptoms (  id,  published_at,  name,  other_names,  updated_at )
    VALUES               ( $id, $published_at, $name, $other_names, $updated_at )
    """
    params = {
        'id': str(symptom.id),  # some old IDs are integers!
        'published_at': symptom.published_at,
        'name': symptom.name,
        'other_names': ','.join(f"'{name}'" for name in symptom.other_names),
        'updated_at': symptom.updated_at,
    }

    connection.execute(query, params).fetchone()

def _write_metric(connection: sqlite3.Connection, metric: Metric) -> None:
    query = f"""
    INSERT INTO metrics (  id,  published_at,  symptom_id,  date,  updated_at,  intensity,  notes )
    VALUES              ( $id, $published_at, $symptom_id, $date, $updated_at, $intensity, $notes )
    """
    params = {
        'id': str(metric.id),  # some old IDs are integers!
        'published_at': metric.published_at,
        'date': metric.date,
        'symptom_id': metric.symptom_id,
        'updated_at': metric.updated_at,
        'intensity': metric.intensity,
        'notes': metric.notes,
    }

    connection.execute(query, params).fetchone()

def main() -> None:
    to_review_dir = Path("/home/dtg/Dropbox/second-brain/health/injury-tracking/health-tracker/json")
    paths = sorted(to_review_dir.glob("*"))
    backups = list(map(_load_json_backup, paths))

    merged = _merge_backups(backups=backups)

    db_path = Path.cwd() / 'consolidation-db.sqlite'
    _clone_truncated_db(to=db_path)

    connection = get_sqlite_connection(db_path=db_path)
    with connection:
        for n, symptom in enumerate(merged.symptoms.values(), start=1):
            print(f"Saving symptom {n}")
            _write_symptom(connection=connection, symptom=symptom)

        for n, metric in enumerate(merged.metrics.values(), start=1):
            print(f"Saving metric {n}")
            _write_metric(connection=connection, metric=metric)

if __name__ == "__main__":
    import os; os.environ['PYTHONBREAKPOINT'] = 'pdb.set_trace'
    main()
