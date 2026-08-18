# 02 Client Analytics Guide

## Purpose
View detailed API analytics for clients, including success/failure/not found rates, with filtering and search.

## What You See
- **Time Filter Dropdown**: Select from preset ranges (Today, Yesterday, Last 7 Days, Last Month, Custom, etc.)
- **API Filter Dropdown**: Select specific API or "All APIs"
- **Status Filter**: All, Success, Failed, Not Found
- **Search Bar**: Search by API name, client name, or other fields
- **Sort Options**: Sort by total hits, success rate, avg response time, or client name
- **Pagination**: Control records per page (10, 25, 50, 100)
- **Data Table**: Rows showing client API statistics with columns

## Table Columns
- Client name / API name
- Total Hits
- Success Rate
- Avg Response Time (ms)
- Status breakdown (success, failed, not found)
- Last updated / timestamp

## Available Actions
- Click the export/download button on any row to download transaction details as CSV
- Refresh data using the refresh button
- Toggle status filter to focus on specific request types
- Use search to find specific entries

## Filters
- **Time Filter**: preset options (today, yesterday, last_7_days, last_month, custom) or custom date range picker
- **API Filter**: Select specific API from the catalog, or "All APIs"
- **Status Filter**: "All Status", "Success", "Failed", "Not Found"
- **Search**: Free-text search across the data table

## Search Behavior
- As you type, the table filters in real-time to match the search query
- Search matches against API name, client name, and other visible fields
- Clear the search by clicking the close/clear button

## Pagination
- Bottom of the table shows pagination controls
- Select page size: 10, 25, 50, or 100 records per page
- Navigate between pages using numbered buttons or prev/next arrows

## Common Situations
- If no data appears, check that the time filter and API selection are appropriate
- "No API Telemetry Found" message means no records match the current filters
- Changing the time range may significantly change the data shown

## Important Notes
- Status "Success" means the API returned a valid response
- Status "Not Found" means the requested resource was not found (404-type responses)
- Status "Failed" means the API request failed (error responses)
- The table supports sorting by clicking column headers
