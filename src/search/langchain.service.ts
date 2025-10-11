/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StateGraph, END, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { SearchService } from './search.service';
import { UploadsService } from 'src/uploads/uploads.service';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { Place } from 'src/places/entity/place.entity';

interface AgentState {
  messages: BaseMessage[];
}

type PlaceWithContext = Place & {
  post_description?: string;
  source?: 'post' | 'place';
};

@Injectable()
export class LangChainService implements OnModuleInit, OnModuleDestroy {
  private app: any;
  private mongoClient: MongoClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly searchService: SearchService,
    private readonly uploadsService: UploadsService,
  ) {}

  async onModuleInit() {
    const mongoUri = this.configService.get<string>('DATABASE_URL');
    this.mongoClient = new MongoClient(mongoUri as string);
    await this.mongoClient.connect();

    const dbName = 'main';
    const db = this.mongoClient.db(dbName);

    const placeLookupTool = (tool as any)(
      async ({ query }: { query: string }) => {
        try {
          console.log(`Tool called with query: "${query}"`);

          if (!this.uploadsService?.generateEmbedding) {
            throw new Error(
              'uploadsService.generateEmbedding is not available',
            );
          }

          console.log('Generating query vector...');
          const queryVector = await this.uploadsService.generateEmbedding(
            `query: ${query}`,
          );
          console.log('Query vector generated, calling _findChatContext...');

          const results = await this.searchService._findChatContext(
            query,
            queryVector,
          );

          console.log(results);

          if (!results || results.length === 0) {
            return 'No relevant places found in the database for that query.';
          }
          return JSON.stringify(results);
        } catch (error) {
          console.error('Error in place lookup tool:', error);
          return 'An error occurred while searching for places.';
        }
      },
      {
        name: 'place_lookup',
        description:
          "Searches the DishDash database to find relevant restaurants, cafes, or posts based on a user's query about food or places.",
        schema: z.object({
          query: z
            .string()
            .describe("The user's search query for a food or place."),
        }) as any,
      },
    ) as any;

    const tools = [placeLookupTool] as any;
    const toolNode = new ToolNode(tools);

    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      apiKey: this.configService.get<string>('GOOGLE_API_KEY'),
    }).bindTools(tools);

    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
    });

    const shouldContinue = (state: AgentState) => {
      const lastMessage = state.messages[state.messages.length - 1];
      console.log(
        'Checking shouldContinue - Last message has tool calls?',
        lastMessage instanceof AIMessage && lastMessage.tool_calls?.length,
      );
      if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
        return 'tools';
      }
      return END;
    };

    const callModel = async (state: AgentState) => {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are a specialized assistant for a food app. Your ONLY job is to help users find places by FIRST using the "place_lookup" tool, then responding based on its results.

          **STEPS TO FOLLOW FOR EVERY USER QUERY:**
          1. ALWAYS start by calling the "place_lookup" tool with the user's query to search for relevant places. Do not respond without calling the tool first.
          2. After receiving the tool's results, analyze them and formulate your answer based ONLY on those results.
          2.1 always return top 3 result from db if you think information is not enough.
          3. Your entire final response (after tool use) MUST be in Farsi. Do not use any English words.
          4. Do NOT use markdown formatting like ** or * in your final response.
          5. If the tool returns no results or an error, your final response should simply be: "متاسفانه مکان مناسبی پیدا نکردم."
          6. If results are found, summarize the top relevant places in Farsi, including key details like name, description.
          6. If results are found, summarize the top relevant places in Farsi, including key details like name, description.
          7. Keep your response concise and helpful.
          8. no disclaimer needed in message.
          9. you dont need to mention phone numbers or coordinates of each place in the answer.`,
        ],
        new MessagesPlaceholder('messages'),
      ]);

      const chain = prompt.pipe(model);

      const response = await chain.invoke({ messages: state.messages });

      // Add these logs for debugging
      console.log('Model response content:', response.content);
      console.log(
        'Model tool calls:',
        response.tool_calls
          ? JSON.stringify(response.tool_calls)
          : 'No tool calls',
      );

      return { messages: [response] };
    };

    const workflow = new StateGraph<AgentState>({
      channels: {
        messages: {
          value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
          default: () => [],
        },
      },
    })
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .setEntryPoint('agent')
      .addConditionalEdges('agent', shouldContinue)
      .addEdge('tools', 'agent');

    const checkpointer = new MongoDBSaver({
      client: this.mongoClient,
      dbName,
    });

    this.app = workflow.compile({ checkpointer });
  }

  async onModuleDestroy() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  }

  async invokeAgent(
    query: string,
    thread_id: string,
  ): Promise<{ aiResponse: string; places: PlaceWithContext[] }> {
    try {
      const finalState = await this.app.invoke(
        { messages: [new HumanMessage(query)] },
        { configurable: { thread_id } },
      );

      const last = finalState.messages[finalState.messages.length - 1];
      let aiResponse = '';
      if (typeof last.content === 'string') {
        aiResponse = last.content;
      } else if (Array.isArray(last.content)) {
        aiResponse = last.content.map((c: any) => c.text ?? '').join(' ');
      }

      const queryVector = await this.uploadsService.generateEmbedding(
        `query: ${query}`,
      );

      const dbResult = await this.searchService._findChatContext(
        query,
        queryVector,
      );

      const mentionedPlaces = dbResult.filter((place) =>
        aiResponse.includes(place.name),
      );

      return {
        aiResponse,
        places: mentionedPlaces,
      };
    } catch (error) {
      console.error('Error in invokeAgent:', error);
      return {
        aiResponse: 'An error occurred.',
        places: [],
      };
    }
  }
}
