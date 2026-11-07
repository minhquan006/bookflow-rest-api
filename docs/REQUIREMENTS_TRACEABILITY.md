# Assignment requirements and evidence

Course: **Web Programming & Applications (503073)**. Topic: **RESTful Web Services**.
Instructor: **Trần Đại Nhân**. Class: **N01_T02**.

The authoritative assignment is [503073-Midterm-V1.docx](503073-Midterm-V1.docx),
including sections I–V, topic ID 1 and the teamwork policy. The deadline supplied
by the team is the end of **8 November 2026, Vietnam time**. Check the course
system for the exact upload mechanism and closing time.

The [system design](PROJECT_BLUEPRINT.md) records the team's implementation choices;
it does not add requirements to the assignment. Application scope and recorded
validation are documented in [implementation status](IMPLEMENTATION_STATUS.md)
and [source validation](SOURCE_FINALIZATION.md).

## Mapping

| Assignment area   | Requirement                                                                                                      | Project evidence or remaining action                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Research          | History, principles, specifications, practices, advantages and limitations, credible references                  | Explain REST and HTTP with primary references; relate claims to the implemented application. Review the report's citations before submission.                                        |
| Topic ID 1        | Suggested REST constraints, HTTP methods, authentication and comparison with GraphQL/SOAP                        | The application demonstrates resource routes, JWT/roles, conditional requests and transaction behavior. Qualitative comparison does not require implementing competing servers.      |
| Website           | A working application with meaningful scope, explained goals, users, architecture and outcomes                   | Catalog, authentication, borrowing/returns, dashboard and audit are integrated; see source validation for tested scope.                                                              |
| Report            | English Word and PDF, 20–60 pages excluding covers and appendices, faculty format, figures/tables and references | Drafts are prepared separately for team review. Check cover details, content, pagination, citations and signatures before uploading.                                                 |
| Source and README | Complete source, dependency manifests, configuration and installation/test instructions                          | Root/client/server lockfiles, migration/seed, setup commands, tests, OpenAPI, Postman and Docker are included. Export the intended commit without local secrets or generated output. |
| Video             | English narration with sound, at most 20 minutes, all members participating, theory and working demonstration    | Record and play back the full video. A slide deck alone does not satisfy this requirement.                                                                                           |
| Presentation      | Slides and participation by every member in the scheduled session                                                | Review the prepared slide draft, rehearse handoffs and confirm the presentation schedule.                                                                                            |
| Teamwork          | Two or three members with identifiable responsibilities and participation                                        | The three-member list and module ownership are in the team handoff; preserve actual contribution and review records.                                                                 |

## Assessment and submission

The assignment allocates six points to the report and four to the demonstration.
Missing an audible demo video or complete source with setup instructions can make
the demonstration component receive zero. The late penalty is one point per day,
including a partial day. Consult the original assignment for the full rubric.

The supplied `TemplateIT.dotx` is the faculty layout reference. Its sample course,
instructor and topic text must be replaced with this project's actual details.
The instructor's name does not establish a degree or academic title.

The team selected React, Express, PostgreSQL and Docker. Its default three-loan
limit and fourteen-day duration are application rules rather than assignment
requirements. Public hosting, microservices, OAuth login, reservations and reminder
email are outside this release. JWT signatures do not encrypt token contents.

Use the [submission guide](SUBMISSION_GUIDE.md) to prepare the final files and
verify their successful upload. Historical benchmark and Newman evidence remains
separate from the final application validation; report the scope actually tested.
