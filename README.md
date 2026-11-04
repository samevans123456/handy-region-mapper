# Handy Region Mapper

I'd like to create a tool that allows the user to create interactive maps of the united kingdom. I particularly want to be able to plot layers of different regions in the UK (perhaps overlapping) with labels (that you can toggle on and off) and an info panel that pops up when you click the region. The info panel will hold customisable data about the region. Underlying it should be a database that stores information with some core fields like region name, region type, and other customisable fields. Use the open geography portal's spatial data for reference (https://geoportal.statistics.gov.uk/search?collection=appAndMap). There should be an uploadable and direct input functionality that allows users to choose from a list of available regions for that region type.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://handy-region-mapper.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7fe8ad88-ca68-48b2-b76b-f91bfcba2908).

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
