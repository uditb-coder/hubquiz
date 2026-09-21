# Cloud Supabase Setup Guide

This guide walks you through setting up the cloud Supabase project as a failover backup for HubQuiz.

## Project Details
- **URL:** https://pxsemvrbchajuqhnetti.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/pxsemvrbchajuqhnetti

## Step 1: Run the Database Schema

Go to **SQL Editor** in the Supabase dashboard and run these scripts IN ORDER:

1. Copy the contents of `sql/01_schema.sql` and run it
2. Copy the contents of `sql/02_functions.sql` and run it
3. Copy the contents of `sql/03_rls.sql` and run it
4. Copy the contents of `sql/06_show_questions.sql` and run it
5. Copy the contents of `migrations/answer_security.sql` and run it
6. Copy the contents of `migrations/admin_function.sql` and run it

## Step 2: Enable Realtime

Go to **Database > Replication** in the dashboard.
Enable Realtime for these tables:
- game_sessions
- players
- answers

## Step 3: Create User Accounts

Go to **Authentication > Users** and create these accounts with the exact same passwords used on JP Nagar:

| Email | Password |
|---|---|
| blryelahanka.hub@comedkares.org | B#SU9^My8AE81! |
| internship@erafoundationindia.org | dpDCm@3GTu!a1! |
| blrjpnagar.hub@comedkares.org | P#%YBFzOggnO1! |
| blrgopalan.hub@comedkares.org | qICrvHAtN^q41! |
| mysuru.hub@comedkares.org | U7UPozn%%z#n1! |
| mangaluru.hub@comedkares.org | PkZAfPyp8@IJ1! |
| belagavi.hub@comedkares.org | ACKzkc@qToba1! |
| kalaburagi.hub@comedkares.org | G*jUOl9X8BG&1! |
| hubballi.hub@comedkares.org | eZ7w!sF9BY0X1! |
| admin@comedkares.org | (choose a secure password) |

## Step 4: Confirm Email for All Users

After creating each user, click on the user and manually confirm their email address (toggle the "Confirmed" switch).

## Step 5: Import Quizzes

Log in to HubQuiz on each hub account while the app is connected to the cloud server (when JP Nagar is down or using a direct cloud URL). Click "Import IDT Quizzes" once per account.

## Important Notes

- **Free Tier Limit:** 200 concurrent realtime connections. This means a maximum of roughly 200 students can be playing simultaneously across all hubs.
- **Database Size:** 500MB on the free tier. More than enough for quiz data.
- **No Sync:** The cloud and JP Nagar databases are independent. Quiz data, game history, and user accounts must be managed separately on each.
