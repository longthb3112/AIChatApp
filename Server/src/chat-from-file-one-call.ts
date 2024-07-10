import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CharacterTextSplitter } from "langchain/text_splitter";

import {BaseMessage, HumanMessage, AIMessage } from 'langchain/schema';

import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { formatDocumentsAsString } from 'langchain/util/document';
import { StringOutputParser } from "@langchain/core/output_parsers";

import {
    ChatPromptTemplate,
    MessagesPlaceholder,
  } from "@langchain/core/prompts";

import { FaissStore } from "@langchain/community/vectorstores/faiss";
const formatMessage = (message: ChatMessage) => {
    if(message.sender === 'ChatGPT'){
      return new AIMessage({ content: message.message, additional_kwargs: {} });
    }else{
      return new HumanMessage({ content: message.message, additional_kwargs: {} });
    }
};


export interface ChatMessage
{
    message: string,
    sender: string,
}

export async function Send(chatMessages:ChatMessage[]) {
    try {
        // Extract the `messages` from the body of the request

        const formattedPreviousMessages = chatMessages.slice(0, -1).map(formatMessage);

        const currentMessageContent = chatMessages[chatMessages.length - 1].message;

        /**************load file and embeded directly */
        // const loader = new TextLoader("./restaurant.txt");
        // const docs = await loader.load();        
        // const splitter = new CharacterTextSplitter({
        //   chunkSize: 200,
        //   chunkOverlap: 50,
        // });        
        // const documents = await splitter.splitDocuments(docs);
        // console.log(documents);       
        // const embeddings = new OpenAIEmbeddings();  
        // const vectorStore = await FaissStore.fromDocuments(documents, embeddings);


       // Retrieve and generate using the relevant snippets of the blog.
       //TODO: setup vector database
       //**************Load from file ***********************/
         const vectorStore = await FaissStore.load("./",  new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
          }));
        const retriever = vectorStore.asRetriever({ k : 3}); // amount of return documents
     
        const llm = new ChatOpenAI({
            apiKey:  process.env.OPENAI_API_KEY,
            model: 'gpt-3.5-turbo',
            temperature: 0,
            streaming: true,
           // verbose: true,
        });
      
        //Contextualizing the question
        const contextualizeQSystemPrompt = `Given a chat history and the latest user question
        which might reference context in the chat history, formulate a standalone question
        which can be understood without the chat history. Do NOT answer the question,
        just reformulate it if needed and otherwise return it as is.`;
        
        const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
          ["system", contextualizeQSystemPrompt],
          new MessagesPlaceholder("chat_history"),
          ["human", "{question}"],
        ]);
        const contextualizeQChain = contextualizeQPrompt
          .pipe(llm)
          .pipe(new StringOutputParser());
        
        const contextualizedQuestion = (input: Record<string, any>) => {
            if ("chat_history" in input) {
                return contextualizeQChain;
            }
            return input.question;
        };

        //Chain with chat history
        const qaSystemPrompt = `You are an assistant for question-answering tasks.
        Use the following pieces of retrieved context and based only on the following context to answer the question.
        Do not answer outside of the context.
        If you don't know the answer, just say that you don't know.
        Use three sentences maximum and keep the answer concise.

        {context}`;

        const qaPrompt = ChatPromptTemplate.fromMessages([
        ["system", qaSystemPrompt],
        new MessagesPlaceholder("chat_history"),
        ["human", "{question}"],
        ]);

         // Helper function to concatenate chat history and current question
        const formatQueryWithChatHistory = (question: string, chatHistory: any[]): string => {
            const history =  chatHistory.filter(msg => msg instanceof HumanMessage).map(msg => msg.content).join('\n');
            return `${history}\n${question}`;
        };
        const ragChain = RunnableSequence.from([
               RunnablePassthrough.assign({
               context: async (input: Record<string, any>) => {
                const fullQuery = formatQueryWithChatHistory(input.question, input.chat_history);
                  var docs = await retriever.invoke(fullQuery);
                  console.log("retriever docs", docs);
                  return formatDocumentsAsString(docs);
              },
            }),
          
          qaPrompt,
          llm,
      ]);
       
         const aiMsg = await ragChain.invoke({ question:currentMessageContent, chat_history:formattedPreviousMessages });        
         console.log("response message:",aiMsg);
        return aiMsg;
    } catch (e: any) {
      console.log("this is Error:",e);
        return Response.json({ error: e.message }, { status: e.status ?? 500 });
    }
}
