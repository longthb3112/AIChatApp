# AIChatApp

A demo for using OpenAI to create chat app with history. This project contains features: 
* Communicate directly with OpenAI LLM
* Conversational RAG using Langchain: comunicate with chat app using external source 

## Getting Started

This project is built in both server side and front end side. These instructions will get you a copy of the project up and running on your local machine for development

### Prerequisites

* Node v22.2.0
* OpenAI v4.37.1
* React 18.3.1
* LangChain 0.0.28
```

### Installing

Server folder :
* npm i
* add .env file in server folder for Global variables: PORT = 8888 and OPENAI_API_KEY: YOUR_OPENAI_KEY
* npm run dev
 
Client folder  : 
* npm i
* If you want to call OPENAPI directly => update API_KEY variable in App.jsx file.
* npm start
```
### Dataset
* Current example is using data from restaurant.txt to generate dataset
* Feel free to update indexes.js with files to generate new dataset and have more experiments.
  
## Built With

* [Node](https://nodejs.org/en/download/package-manager) - Server framework
* [npm](https://www.npmjs.com) - Dependency Management
* [React](https://react.dev/) - Web framework
* [Langchain](https://www.langchain.com/) - RAG framework

## Authors

* **Long Tran**

## Demo Image
![Demo Image](https://github.com/longthb3112/AIChatApp/blob/main/ChatApp.PNG)
