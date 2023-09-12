APP_NAME:=health-tracker
WEBAPP_NAME:=$(APP_NAME)-webapp
API_NAME:=$(APP_NAME)-api

set_up_development_environment:
	@echo ""
	@echo Installing git hooks...
	make install_dev_tools

	@echo ""
	@echo ""
	@echo Installing NPM dependencies outside of the container, to support pre-push builds...
	@# this step is necessary because otherwise docker compose creates a node_modules
	@# folder with root permissions and outside-container build fails
	cd webapp; npm ci

	@echo ""
	@echo ""
	@echo To start webapp:  make run_webapp
	@echo To start api:     make run_api

install_dev_tools:
	pre-commit install  # pre-commit is (default)
	pre-commit install --hook-type pre-push

uninstall_dev_tools:
	pre-commit uninstall  # pre-commit is (default)
	pre-commit uninstall --hook-type pre-push


#===============================================================================
#
#   webapp
#
#===============================================================================

run_webapp:
	scripts/print_local_ip_via_qr.sh
	docker compose up $(WEBAPP_NAME)

# Recreate web app docker image
rebuild_webapp:
	docker compose down
	docker image rm $(WEBAPP_NAME) || (echo "No $(WEBAPP_NAME) found, all good."; exit 0)
	docker compose build $(WEBAPP_NAME)

test_dev_webapp:
	docker compose run --rm $(WEBAPP_NAME) npm test

shell_webapp:
	docker compose run --rm $(WEBAPP_NAME) bash

deploy_webapp_from_local:
	cd ./webapp \
		&& npm run deploy_from_local
	@# TODO: docker compose run --rm $(WEBAPP_NAME) npm run deploy_from_local

build_webapp:
	scripts/build_webapp.sh


#===============================================================================
#
#   API
#
#===============================================================================

run_api:
	docker compose up $(API_NAME)

rebuild_api:
	docker compose down $(API_NAME)
	docker compose build $(API_NAME)

delete_api_db_file:
	rm -f $(SQLITE_DB_PATH)

create_api_db_file:
	touch $(SQLITE_DB_PATH)

deploy_api:
	@echo "Make sure to run this in the server"
	api/bin/pull_latest_and_run
