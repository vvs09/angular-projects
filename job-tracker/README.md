# JobTracker

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.10.

Two tools in one app: a job application tracker (`/`) and a real-time collaborative whiteboard (`/whiteboard`).

Requires Node 22.22+ (Angular 22). With nvm: `nvm use 22`.

## Development server

Run `npm run dev` to start both the whiteboard sync server (port 4201) and the Angular dev server, then open `http://localhost:4200/`.

- `npm start` runs only the Angular app. The job tracker works fully; the whiteboard works offline and shows "Offline" until the sync server is running.
- `npm run server` runs only the whiteboard sync server.

The dev server proxies `/ws` to the sync server (see `proxy.conf.json`), so everyone uses the same URL. To draw together from other devices on your network, run `npx ng serve --host 0.0.0.0` alongside `npm run server` and share the invite link using your machine's IP address. Whiteboard rooms are kept in the server's memory and are lost when it restarts.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
