# How To Understand Large Codebases

Whether your goal is to contribute or just understand how the code works, hopping onto any codebase you didn't author can be overwhelming at first sight. You even have it worse if it's a large repository. You are not alone. No one expects themselves or others to understand one the first time. In some even worse cases, you may never get to the bottom of it (_Coughs_ Skill Issues _Coughs_). And that's fine. Imagine trying to go through google's [2 billion lines](https://dl.acm.org/doi/pdf/10.1145/2854146) codebase. Goodluck with that.

However, there's a lot of ways to make you understand the code and even contribute to it easier.

## What does the repository do?

This is the very first step. You should be able to explain what the codebase is supposed to achieve. E.g "This is a package that pads the left side of a string", "This is the web application of a https://example.com", "This is a cli tool generates xyz package".

This is a very important step. Because it helps make clarity on what you want to actually understand/contribute about it. Many large repositories will comprise of multiple applications and often use monorepos (See my [article on Monorepos](https://blog.complexlity.dev/posts/a-beginners-guide-to-monorepos)).
This means, you have to also decide what particular "application" of the repository you need to understand/contribute to. This gives you a starting point from which you can use the Top-Down approach to get to other parts of the codebase.

## Programming Language Understanding

Once you know what the repository is supposed to do and what parts of the repository you want to start from, you also need to ensure that part you are about to travail is written in a language you are comfortable with.

Generally, as a programmer, you should be able to read good code irrespective of the language as variable names, code similarity to your language and a few minutes of googling, can get you started. However, if you haven't built on a language, you should know it take you longer time to understand and contribute to compared to one which you have built projects on.

Sometimes, you might need to understand it despite not having experience in the language (e.g New job, New team at workplace, Language/Framework specific requirements, etc). In this case, I suggest you take a few days to learn about the language and write some algorithms with it. This could include doing some FizzBuzz, or some code challenges with the language. This will greatly increase your position compared to if you didn't.

## Understand the Project Structure

![Project Structure](https://i.ibb.co/jWYJCsk/Screenshot-2024-06-17-at-15-09-01.png)

**Fig**: An example folder structure of a Javascript codebase.

In many cases, if you already have considerable experience in the language, this should be an straighforward step. You already know what to expect.
For example, in a javascript codebase, I expect to find a package.json at the top level. I also expect to see a src folder. If they use typescript, I expect to find a .tsconfig.json. This expectation is often reality and I am 1 step toward understanding this repository just knowing what the general folders standards are.

If you don't have as much experience in the ecosystem, you should skim through the folders of the repository (or the part you have taken interest in) and try to "guess" what the folder should do. Folder names and filenames would often give away what the folder is for and what the files in them should do.

## Documentation And Instructions

Once you understand the folder structure, now it's time to actually understand the code. In most repositories, you should see a document describing how to setup the codebase for developement (for example a ReadME.md or installation.txt). Go through these files and follow whatever steps they recommend. Also take note of all the instructions and **NOTE**s they provide.

This should give you all you need to setup the project locally and get started. In some cases, this may not be as smooth. Here's some common issues you could run into

- DB migration/seeding: Sometimes, for the code to run smoothly, it needs some data or tables in the db which other parts of the application use to run (in web applications). In some cases, you would be given a sample seed file which auto generates this. But if not, you would need to find a way to either disconnect that part of the code, or create the tables, data manually before starting

- Dependencies Failing: The version of some packages, when updated on your end, could just break. Oh the number of times this has happened to me. I often go into the package.json and pin those breaking dependencies and clean install. This helps. You would likely not run into this if it is an actively maintained repository. However, it's good to expect this could happen and not panic when it does.

- "It works on my machine": There's some errors that just happen because maybe you use a not-so-common linux distros or some random other reason. I can't help you here. You'd need to do some googling to find what's exactly causing the issue.
  [Docker](https://www.docker.com/) solves this. Some repositories come with some `docker.compose.yml` or `Dockerfile` which would create a machine containing everything needed for the code to run smoothly with just a few commands.

## Actually Reading The Code

There's different ways to go about understanding the code line by line. It usually depends on what the code should do. Here's some general rules that would help

1. Find the entry point: This is the `index.js`, `index.html`, `main.py` etc of the code. Where the main application is running.

2. Fuck Around and Find Out: Yes, similar to how you debug issues. Change some variables, try to add some feature, move fast and break things. Each time you add or break a part of the code, you learn something about the system and how they fit together.

In UI related code, change some stylings, refactor some logic, remove some components, etc.

## Ask Questions

With the evolution of AI, you can now ask it about code related questions giving it some context. [Cursor](https://www.cursor.com/) is an AI code editor that is built specifically for this. There's also [Github Copilot](https://github.com/features/copilot), [Cody](https://sourcegraph.com/cody) and probably many more.

Another option is asking someone who built/maintains it. This is mostly not feasible and in cases where it is, this should come first even. They would often speedrun you way faster than all the struggle you had to go through.

## Conclusion

Reading code you didn't author is a difficult process and you are not alone. It takes time and effort for anyone but eventually you would get used to the process. Goodluck!
