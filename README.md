# Shepherd's Flock

Build a mobile app called “Shepherd”.

 

The app is designed for churches to manage members, record attendance, monitor absentees, and improve pastoral care.

 

User Roles

 

Create the following user roles:

 

* Senior Pastor (Full Access)

* Attendance Officer

* Follow-up Team (Full Access

* Department Leader (Can only view members in their department)

*Floor member

 

Member Database

 

Create a Members table with these fields:

* Member ID (Auto-generated)

* Full Name

* Photo

* Phone Number

* Email Address

* Home Address

* Gender

* Date of Birth (month and Year only)

* Age bracket (under 18, 18-29, 30-39, 40-49, 50 and Above)

* Wedding Anniversary

* Marital Status

* Department (optional)

* Membership Date (year of joining the church)

* Age Bracket

 

Attendance

Create an Attendance table containing:

* Attendance ID

* Member

* Date

* Service Type (Sunday Service, Midweek Service, Special Program)

* Attendance Status (Present, Absent, Late)

* Check-in Time

 

Members should be checked in by:

Tapping on a large round icon that will only be active when a member is within the church premises and upon tapping on the check-in icon, the user should be asked if the member asked if they invited someone, if yes, they should be allowed to create a profile for the invitee, but if no, then they should proceed to check-in.



Attendance should automatically be saved.

 

Dashboard

 

Create a dashboard showing:

* Total Members (viewable to all users except floor member)

* Members Present Today (viewable to all users except floor member)

* Members Absent Today (viewable to all users except floor member)

* First-Time Visitors (viewable to all users except floor member)

* Birthdays Today (viewable to all users)

* Wedding Anniversaries Today (viewable to all users)

* Members Who Missed Two Consecutive Sundays (viewable to all users except floor member)

 

Notifications

* A member misses two consecutive Sunday services. (notify all users except floor members)

* A member has a birthday today. (notify all users)

* A member has a wedding anniversary today. (notify all users)

 

Follow-up

Create a Follow-up page where leaders can record:

* Phone Call

* SMS

* WhatsApp Message

* Home Visit

* Sick

* Traveling

* Relocated

* Date Contacted

* Follow-up Notes

 

Reports

Generate reports for:

* Weekly Attendance

* Monthly Attendance

* Yearly Attendance

* Attendance by Department

* Attendance by Age Bracket

* Attendance by Gender

* Birthday Report

* Anniversary Report

* Inactive Members

 

Search

Allow users (except floor members) to search for any member by:

* Name

* Phone Number

* Member ID

 

Display the member’s profile and attendance history.

 

Design

 

The app should have a clean, modern church-themed interface using blue and white colors.

 

The home screen should contain large buttons for:

 

* Check In

* Members (Viewable to all users except floor members)

* Attendance (Viewable to all users except floor members)

* Follow-up (Viewable to all users except floor members)

* Reports (Viewable to all users except floor members)

* Dashboard (Viewable to all users except floor members)

* Settings (Viewable to all users except floor members)

 

The app should be mobile-friendly, simple to use, and require minimal training for church volunteers. Upon onboarding/registration, there should be a box requesting a unique ID “HOPEHALL” (should be optional), this should be used to determine the user role, and anyone that includes this code should have full access to every feature of the app.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flock-care-manager.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/45d98a9b-6adb-4236-832a-e226c0bad88a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
