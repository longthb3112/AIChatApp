
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

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
        const retriever = vectorStore.asRetriever({ k : 3}); // k is amount of return documents
     
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
        const qaSystemPrompt = `You are an assistant specialized in answering questions using retrieved information.
        Utilize the provided context to answer the question, ensuring that your response is based solely on the given information.
        If the answer is not explicitly stated, infer logically from the available data while maintaining accuracy.
        Do not introduce information that is not supported by the retrieved context.
        If you don't know the answer, just say that you don't know.
        Use three sentences maximum and keep the answer concise.

        {context}`;

        const qaPrompt = ChatPromptTemplate.fromMessages([
        ["system", qaSystemPrompt],
        new MessagesPlaceholder("chat_history"),
        ["human", "{question}"],
        ]);

        
    
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
