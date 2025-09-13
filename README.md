# Almacenes Brissa Services

Backend and masterdata services

## Customer Sync Service

This service provides a mechanism to synchronize customer data from the main account (`almacenesbrissa`) to a configurable list of sub-accounts.

### Features

- **Automatic Sync on Create/Update**: The service listens for customer creation and update events in the main account and automatically syncs the data to the sub-accounts.
- **Manual Sync**: A manual sync can be triggered for a specific date range.
- **Configurable**: The list of sub-accounts and the fields to sync can be configured in the app's settings in the VTEX admin.

### API Endpoints

- `POST /v1/sync/cl/created`

  Triggered by a Master Data trigger when a new customer is created. The request body should contain the `Id` of the new customer document.

- `PUT /v1/sync/cl/updated`

  Triggered by a Master Data trigger when a customer is updated. The request body should contain the `Id` of the updated customer document.

- `POST /v1/sync/cl/manual`

  Manually triggers a sync process. The request body should be a JSON object with a `syncDate` property, for example: `{"syncDate": "2025-09-01"}`. This will sync all customers created or updated after the specified date.

### Configuration

The following settings can be configured in the app's settings in the VTEX admin:

- **VTEX App Key**: The VTEX App Key for authentication.
- **VTEX App Token**: The VTEX App Token for authentication.
- **Sub-accounts**: A comma-separated list of sub-accounts to sync to (e.g., `kioskoseventos,kioskotiendas`).
- **Fields to Sync**: A comma-separated list of fields from the `CL` entity to sync.
