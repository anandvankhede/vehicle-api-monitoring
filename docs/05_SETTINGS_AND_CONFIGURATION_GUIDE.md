# 05 Settings and Configuration Guide

## Purpose
System configuration and management for the application.

## What You See
- **Summary Cards**: Total clients, total APIs, healthy/degraded API counts
- **User Filter**: Select specific client or "All Users"
- **Available APIs Dropdown**: List of APIs available for monitoring
- **API Monitoring Section**: Time filter, API selection, data tables, charts
- **User API Performance Grid**: Per-client API statistics KPI cards

## Available Actions
- Select a different client from the user filter
- Choose a specific API from the APIs dropdown
- Change the time filter (last 7 days, last 30 days, custom range)
- Refresh data using the refresh button
- View detailed charts via the "Details Chart" navigation

## Filters
- User/Client filter: "All Users" or specific client name
- API filter: Specific API name or "All APIs"
- Time filter: last_7_days, last_30_days, this_month, custom range
- Date range picker: For custom ranges

## Expected Result
- Summary stats update based on selected filters
- API monitoring charts show data for the selected time period and API
- User API grid shows per-client statistics

## Important Notes
- The dashboard data is refreshed periodically via polling
- Some data may take a moment to load on initial load
- Filtering by a specific client will show only that client's data
- "Degraded APIs" indicates APIs with performance issues or error rates
