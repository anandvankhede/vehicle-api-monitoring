# 03 API Access Management Guide

## Purpose
Manage API access requests from clients - approve or reject requests for API access.

## What You See
- **API Requests Table**: List of all API access requests pending approval
- Each request typically shows:
  - Client company name
  - Requested API name
  - Request status (Pending Approval, Approved, Rejected)
  - Date/time of request
  - Action buttons

## Available Actions
- **Approve Request**: Approve the API access request and assign the API to the client
- **Reject Request**: Reject the request with a reason
- **View Details**: See more information about a specific request
- **Filter by Status**: Filter requests by "all", "Pending Approval", "Approved", "Rejected"

## Filters
- **Status Filter**: Dropdown to filter by request status
  - "all": Show all requests
  - "Pending Approval": Show only pending requests
  - "Approved": Show approved requests
  - "Rejected": Show rejected requests
- **Client Filter**: Filter requests for a specific client
- **Search**: Find requests by client name or API name

## How to Use
1. Navigate to the Client Management API Requests tab
2. Use the status filter to narrow down to pending requests if needed
3. Find the request you want to approve or reject
4. Click the "Approve" button - you'll be prompted for pricing configuration
5. Or click "Reject" and provide a rejection reason
6. The request status will be updated and the client will be notified

## Expected Result
- After approval: The API is assigned to the client with the specified pricing and limits
- After rejection: The request status is updated to "Rejected" and the client is notified
- The table refreshes to reflect the new status

## Important Notes
- Approving a request requires configuring pricing: price per hit, success price, not-found price, currency, request limits, and expiry date
- Rejecting a request requires providing a reason
- Once approved, the client can immediately start using the assigned API
- The system creates activity records and audit logs for approval/rejection actions
