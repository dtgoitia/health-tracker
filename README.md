## Setup repo

```shell
make set-up-development-environment
```

## Usage

```shell
# To spin up frontend and backend
make run

# To remove containers
docker compose down
```

NOTE: requires having docker installed.

See `Makefile` for more development related commands.

## Test CI pipeline

Requires having [act][1] installed.

Run all workflows under `.github/workflows`:

```shell
act
```

Run a specific job:

```shell
act --job deploy-webapp
```

## Environment variables

- `PUBLIC_GITHUB_REPOSITORY`: reference to the repository, including the user name `john-doe/my-app`
- `PUBLIC_GITHUB_ACCOUNT_TOKEN`: GitHub token `public_repo` scope.

## Common issues

- _My browser doesn't offer me the option to install the PWA_.
  Check you are accessing the website via HTTPS - instead of HTTP.

<!-- External references -->

[1]: https://nektosact.com/beginner/index.html "act - User Guide"
