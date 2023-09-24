"""
Find identically named symptoms, and merge them all (and their metrics) under a single symptom
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias
import datetime
import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

SymptomId: TypeAlias = str
SymptomName: TypeAlias = str
MetricId: TypeAlias = str

DB_PATH = Path('/home/dtg/projects/health-tracker/consolidation-db.sqlite')

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


def _row_to_symptom(row: tuple) -> Symptom:
    return Symptom(
        id=row[0],
        published_at=datetime.datetime.fromisoformat(row[1]),
        name=row[2],
        other_names=row[3],
        updated_at=datetime.datetime.fromisoformat(row[4]),
    )


def _read_symptoms(connection: sqlite3.Connection) -> list[Symptom]:
    with connection:
        result = connection.execute("SELECT * FROM symptoms").fetchall()
        return list(map(_row_to_symptom, result))


def _find_similar_symptoms(symptoms: list[Symptom]) -> dict[SymptomName, set[SymptomId]]:
    # find those with identical names
    _map: dict[SymptomName, set[SymptomId]] = {}
    for symptom in symptoms:
        name = symptom.name
        if name in _map:
            _map[name].add(symptom.id)
        else:
            _map[name] = {symptom.id}

    duplicated = {name: ids for name, ids in _map.items() if len(ids) > 1}
    return duplicated


def _replace_symptom_ids_of_metrics(connection: sqlite3.Connection, preferred_id: SymptomId, to_replace: SymptomId) -> None:
    print(f'replacing metric.symptom_id={to_replace!r} for {preferred_id!r}')
    amount = connection.execute(f"SELECT count(0) FROM metrics WHERE symptom_id = '{to_replace}'").fetchall()[0][0]
    if amount == 0:
        print(f'symptom {to_replace!r}: no metrics found')
        return

    print(f'symptom {to_replace!r}: {amount} metrics found')

    query = """
    UPDATE metrics
        SET symptom_id=$preferred_symptom_id
    WHERE symptom_id = $symptom_id_to_replace
    """
    params = {
        'preferred_symptom_id': preferred_id,
        'symptom_id_to_replace': to_replace,
    }

    print(f'symptom {to_replace!r}: replacing metric.symptom_id...')
    connection.execute(query, params).fetchone()
    print(f'symptom {to_replace!r}: replaced metric.symptom_id')


def _delete_symptom(connection: sqlite3.Connection, id: SymptomId) -> None:
    print(f'symptom {id!r}: deleting symptom...')
    query = "DELETE FROM symptoms WHERE id = $id"
    params = { 'id': id }

    connection.execute(query, params).fetchone()

    print(f'symptom {id!r}: deleted symptom')


def _merge_duplicated_symptoms(connection: sqlite3.Connection, duplicated_ids: set[SymptomId]) -> None:
    # select the most adequate symptom ID
    # REMINDER: some IDs are simply IDs
    preferred_id = next(iter(i for i in duplicated_ids if i.startswith("sym_")))
    ids_to_drop = [i for i in duplicated_ids if i != preferred_id]

    for symptom_id in ids_to_drop:
        _replace_symptom_ids_of_metrics(
            connection=connection,
            preferred_id=preferred_id,
            to_replace=symptom_id,
        )
        _delete_symptom(connection=connection, id=symptom_id)


def main() -> None:
    db_path=DB_PATH

    connection = get_sqlite_connection(db_path=db_path)
    symptoms = _read_symptoms(connection=connection)

    duplicated_symptoms = _find_similar_symptoms(symptoms=symptoms)
    for symptom_ids in duplicated_symptoms.values():
        with connection:
            _merge_duplicated_symptoms(connection=connection, duplicated_ids=symptom_ids)


if __name__ == "__main__":
    import os; os.environ['PYTHONBREAKPOINT'] = 'pdb.set_trace'
    main()
