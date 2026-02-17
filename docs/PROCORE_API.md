# Procore API Reference

## Developer Portal
- **Main docs:** https://developers.procore.com
- **API Reference:** https://developers.procore.com/reference/rest/docs/rest-api-overview
- **RESTful Concepts:** https://developers.procore.com/documentation/restful-api-concepts
- **GitHub (docs source):** https://github.com/procore/documentation

## Base URLs
- **Production:** `https://api.procore.com/rest/v1.1`
- **Sandbox:** `https://sandbox.procore.com/rest/v1.1`
- **OAuth Auth:** `https://login.procore.com/oauth/authorize`
- **OAuth Token:** `https://login.procore.com/oauth/token`

## Authentication
- **OAuth 2.0** (Authorization Code flow)
- Tokens are **user-scoped** — each PM signs in individually
- Access tokens expire → use refresh tokens
- Docs: https://developers.procore.com/documentation/oauth-introduction

## Key API Endpoints

### Projects
- `GET /rest/v1.1/projects` — List all projects
- `GET /rest/v1.1/projects/{id}` — Get project details
- Ref: https://developers.procore.com/reference/rest/v1/projects

### RFIs
- `GET /rest/v1.1/projects/{project_id}/rfis` — List RFIs
- `GET /rest/v1.1/projects/{project_id}/rfis/{id}` — Get RFI detail
- `POST /rest/v1.1/projects/{project_id}/rfis` — Create RFI
- Ref: https://developers.procore.com/reference/rest/rfis?version=latest

### Submittals
- `GET /rest/v1.1/projects/{project_id}/submittals` — List submittals
- `GET /rest/v1.1/projects/{project_id}/submittals/{id}` — Get submittal
- Ref: https://developers.procore.com/reference/rest/v1/submittals?version=1.1

### Budget
- `GET /rest/v1.1/projects/{project_id}/budget/views` — Budget views
- `GET /rest/v1.1/projects/{project_id}/budget/line_items` — Line items
- Ref: https://developers.procore.com/reference/rest/v1/budget-line-items

### Payment Applications (Requisitions)
- `GET /rest/v1.1/projects/{project_id}/requisitions/requisition_groups` — List pay apps
- Ref: https://developers.procore.com/documentation/tutorial-requisitions

### Daily Logs
- `GET /rest/v1.1/projects/{project_id}/daily_logs` — List daily logs
- Ref: https://developers.procore.com/reference/rest/v1/daily-logs

### Change Orders
- `GET /rest/v1.1/projects/{project_id}/change_order_packages` — List COs
- Ref: https://developers.procore.com/reference/rest/v1/change-order-packages

### Punch List
- `GET /rest/v1.1/projects/{project_id}/punch_items` — List punch items
- Ref: https://developers.procore.com/reference/rest/v1/punch-items

### Directory (Vendors/Contacts)
- `GET /rest/v1.1/projects/{project_id}/vendors` — Project directory
- Ref: https://developers.procore.com/reference/rest/v1/vendors

### Schedule
- `GET /rest/v1.1/projects/{project_id}/schedule/tasks` — Schedule tasks
- Ref: https://developers.procore.com/reference/rest/v1/schedule-tasks

### Documents
- `GET /rest/v1.1/projects/{project_id}/documents` — List documents
- Ref: https://developers.procore.com/reference/rest/v1/documents

### Observations (Safety)
- `GET /rest/v1.1/projects/{project_id}/observations/items` — Safety observations
- Ref: https://developers.procore.com/documentation/tutorial-observations

### Workflows
- Ref: https://developers.procore.com/documentation/tutorial-workflows

## Headers Required
```
Authorization: Bearer {access_token}
Procore-Company-Id: {company_id}
Content-Type: application/json
```

## Rate Limits
- 3,600 requests per hour per access token
- Rate limit headers: `X-Rate-Limit-Remaining`, `X-Rate-Limit-Reset`

## Webhooks (Future)
- Procore supports webhooks for real-time events
- Can trigger agent actions on: new RFI, submittal status change, etc.
- Docs: https://developers.procore.com/documentation/webhooks

## SDK
- No official Python SDK — use REST directly
- Community: https://github.com/procore

## Notes
- Sandbox available for development (separate base URL)
- Need to register a Procore Developer App to get client_id/secret
- Register at: https://developers.procore.com/documentation/new-app
