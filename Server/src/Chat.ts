import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from 'langchain/schema';

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

//  import { JSONLoader } from "langchain/document_loaders/fs/json";
/**
 * Basic memory formatter that stringifies and passes
 * message history directly into the model.
 */
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

         // load a JSON object
         const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 200,
            chunkOverlap: 50,
          });
        const docs = await textSplitter.createDocuments([
            JSON.stringify({
            "state": "Kansas",
            "slug": "kansas",
            "code": "KS",
            "nickname": "Sunflower State",
            "website": "https://www.kansas.gov",
            "admission_date": "1861-01-29",
            "admission_number": 34,
            "capital_city": "Topeka",
            "capital_url": "http://www.topeka.org",
            "population": 2893957,
            "population_rank": 34,
            "constitution_url": "https://kslib.info/405/Kansas-Constitution",
            "twitter_url": "http://www.twitter.com/ksgovernment",
        }),JSON.stringify({
            "state": "Texas",
            "slug": "texas",
            "code": "TX",
            "nickname": "Lone Star State",
            "website": "https://www.texas.gov",
            "admission_date": "1845-12-29",
            "admission_number": 28,
            "capital_city": "Austin",
            "capital_url": "http://www.austintexas.gov",
            "population": 26448193,
            "population_rank": 2,
            "constitution_url": "http://www.constitution.legis.state.tx.us",
            "state_flag_url": "https://cdn.civil.services/us-states/flags/texas-large.png",
            "state_seal_url": "https://cdn.civil.services/us-states/seals/texas-large.png",
            "map_image_url": "https://cdn.civil.services/us-states/maps/texas-large.png",
            "landscape_background_url": "https://cdn.civil.services/us-states/backgrounds/1280x720/landscape/texas.jpg",
            "skyline_background_url": "https://cdn.civil.services/us-states/backgrounds/1280x720/skyline/texas.jpg",
            "twitter_url": "https://twitter.com/texasgov",
            "facebook_url": "http://www.facebook.com/Texas.gov"
        }), JSON.stringify({"Ori":"Long 's daughter"})]);
             
          const splits = await textSplitter.splitDocuments(docs);
          const vectorStore = await MemoryVectorStore.fromDocuments(
            splits,
            new OpenAIEmbeddings({
                openAIApiKey: process.env.OPENAI_API_KEY,
              })
          );
       

       //TODO: setup vector database
        const retriever = vectorStore.asRetriever();
     
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

        const contextualizedQuestion = (input: Record<string, any>) => {
        if ("chat_history" in input) {
            return contextualizeQChain;
        }
        return input.question;
        };

        const ragChain = RunnableSequence.from([
            RunnablePassthrough.assign({
              context: (input: Record<string, any>) => {
                if ("chat_history" in input) {
                  const chain = contextualizedQuestion(input);
                  return chain.pipe(retriever).pipe(formatDocumentsAsString);
                }
                return "";
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
