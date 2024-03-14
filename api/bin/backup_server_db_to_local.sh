#!/bin/bash

# Usage example
# cd projects/health-tracker/api
# K3S_CLUSTER_URL=88.198.150.140 bash api/bin/backup_server_db_to_local.sh kk.db

set -eu

# Default values
remote_user="epo"


timestamp="$( \
    date --iso-8601=seconds --utc \
    | cut -d "+" -f 1 \
    | tr -d "-" \
    | tr -d ":" \
    | tr "T" "-" \
)"
default_backup_filename="${timestamp}-health-tracker-backup.db"

# If not name provided via CLI arg, use default
db_backup_file="${1:-"${default_backup_filename}"}"

set +u
if [[ -z "${K3S_CLUSTER_URL}" ]]; then
    echo "Please set K3S_CLUSTER_URL environment variable"
    exit 1
fi
set -u

db_backup_path="$(pwd)/${db_backup_file}"

# Pull file from server
source="${remote_user}@${K3S_CLUSTER_URL}:/home/${remote_user}/k3s-data/health-tracker-api-db.sqlite"
destiny="${db_backup_path}"
echo "Sending file over SSH:"
echo "  from: ${source}"
echo "  to:   ${destiny}"
echo ""
scp "${source}" "${destiny}"
