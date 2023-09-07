Install [SQLx CLI][1]:

```shell
cargo install sqlx-cli
```

## Manually deploy API

At the moment, CI automatically builds the API image, but you need to manually deploy it from inside the server:

```shell
GITLAB_USERNAME='...' GITLAB_CONTAINER_REGISTRY_TOKEN='...' make deploy_api
```

<!-- External references -->

[1]: https://github.com/launchbadge/sqlx/blob/main/sqlx-cli/README.md
