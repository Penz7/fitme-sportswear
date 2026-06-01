# Sportswear Main Core

- Path: `sportswear-main`.
- Java package root: `vn.fitme.sportswear`.
- Layered directories include common third-app clients/config, config, constants/enums, controller, converter, mapper, processor, repository, runner, scheduler, service.
- Spring Boot app is configured via `src/main/resources/application.yaml` plus `application-local/dev/prod.yaml`.
- Base config enables scheduler/webhook by default, disables create-order-in-pancake, create-product-in-shopify, and sync-address by default; confirm profile/env before changing side-effectful integration flows.
- Integrations include Telegram notifications and Gemini-backed Vietnamese address normalization prompts in config.