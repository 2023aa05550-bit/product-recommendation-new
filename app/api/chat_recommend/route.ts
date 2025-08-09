import { type NextRequest, NextResponse } from "next/server"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface SessionItem {
  product: string
  "product name": string
  description: string
  engagement: "click" | "hover" | "share"
  "dwell time": number
  added_to_cart: 0 | 1
  "product popularity": number
  net_feedback: number
  image: string
  event_sequence_number: number
}

interface SessionData {
  session_id: string
  itemlist: SessionItem[]
}

interface RecommendedProduct {
  id: string
  name: string
  description: string
  category: string
  image: string
  popularity: number
  net_feedback: number
  recommendation_score: number
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, session_id, session_data, chat_history, available_products } = body

    if (!message || !session_id) {
      return NextResponse.json({ error: "Message and session_id are required" }, { status: 400 })
    }

    const lowerMessage = message.toLowerCase()
    let response = ""
    let recommendations: RecommendedProduct[] = []

    // Helper function to extract product info
    const getProductName = (product: any, index: number): string => {
      const nameFields = [
        "name",
        "Name",
        "title",
        "Title",
        "productName",
        "product_name",
        "itemName",
        "item_name",
        "label",
        "Label",
      ]

      for (const field of nameFields) {
        if (product[field] && typeof product[field] === "string" && product[field].trim()) {
          return product[field].trim()
        }
      }
      return `Product ${index + 1}`
    }

    const getProductDescription = (product: any): string => {
      const descFields = ["description", "Description", "desc", "Desc", "details", "Details", "summary", "Summary"]

      for (const field of descFields) {
        if (product[field] && typeof product[field] === "string" && product[field].trim()) {
          return product[field].trim()
        }
      }
      return "No description available"
    }

    const getProductCategory = (product: any): string => {
      const categoryFields = ["category", "Category", "type", "Type", "group", "Group"]

      for (const field of categoryFields) {
        if (product[field] && typeof product[field] === "string" && product[field].trim()) {
          return product[field].trim()
        }
      }
      return "Uncategorized"
    }

    // Search through available products if provided
    if (available_products && available_products.length > 0) {
      const matchingProducts = available_products.filter((product: any) => {
        const productName = getProductName(product, product.originalIndex || 0).toLowerCase()
        const description = getProductDescription(product).toLowerCase()
        const category = getProductCategory(product).toLowerCase()

        return (
          productName.includes(lowerMessage) ||
          description.includes(lowerMessage) ||
          category.includes(lowerMessage) ||
          // Specific keyword matching
          (lowerMessage.includes("harry potter") &&
            (productName.includes("harry") ||
              productName.includes("potter") ||
              description.includes("harry") ||
              description.includes("potter"))) ||
          (lowerMessage.includes("book") &&
            (category.includes("book") || description.includes("book") || productName.includes("book"))) ||
          (lowerMessage.includes("movie") &&
            (category.includes("movie") || description.includes("movie") || description.includes("film"))) ||
          (lowerMessage.includes("tech") &&
            (category.includes("tech") || description.includes("tech") || description.includes("electronic"))) ||
          (lowerMessage.includes("toy") &&
            (category.includes("toy") || description.includes("toy") || productName.includes("toy")))
        )
      })

      if (matchingProducts.length > 0) {
        response = `Perfect! I found ${matchingProducts.length} item${matchingProducts.length > 1 ? "s" : ""} matching "${message}". ${matchingProducts.length > 1 ? "Here are your matches:" : "Here it is:"}`

        recommendations = matchingProducts.slice(0, 6).map((product: any, index: number) => ({
          id: `search-${product.originalIndex || index}`,
          name: getProductName(product, product.originalIndex || 0),
          description: getProductDescription(product),
          category: getProductCategory(product),
          image: "/placeholder.svg?height=300&width=300",
          popularity: Math.floor(Math.random() * 1000) + 100,
          net_feedback: Math.floor(Math.random() * 500) + 50,
          recommendation_score: 0.95,
          reason: `Matches your search: "${message}"`,
        }))
      } else {
        // No direct matches found
        response = `I couldn't find any items specifically matching "${message}" in our current inventory. Let me suggest some popular alternatives or try searching for broader categories like "books", "movies", "technology", or describe what you're looking for in more detail.`
        recommendations = []
      }
    } else {
      // Fallback to category-based recommendations
      if (lowerMessage.includes("book") || lowerMessage.includes("read") || lowerMessage.includes("novel")) {
        response =
          "I see you're interested in books! Here are some great reads for you. Are you looking for fiction, non-fiction, or a specific genre?"
        recommendations = [
          {
            id: "api-book-1",
            name: "The Seven Husbands of Evelyn Hugo",
            description: "A captivating novel about a reclusive Hollywood icon's life story",
            category: "Books",
            image: "/placeholder.svg?height=300&width=300",
            popularity: 1200,
            net_feedback: 950,
            recommendation_score: 0.96,
            reason: "Perfect match for book lovers",
          },
          {
            id: "api-book-2",
            name: "Atomic Habits",
            description: "Transform your life with tiny changes that deliver remarkable results",
            category: "Books",
            image: "/placeholder.svg?height=300&width=300",
            popularity: 1500,
            net_feedback: 1100,
            recommendation_score: 0.94,
            reason: "Highly recommended for personal growth",
          },
        ]
      } else {
        response = `I'd love to help you find what you're looking for! Could you be more specific about "${message}"? For example, are you looking for books, movies, technology items, toys, or something else?`
        recommendations = []
      }
    }

    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    return NextResponse.json({
      response,
      recommendations,
      session_id,
    })
  } catch (error) {
    console.error("Error in chat recommendation:", error)
    return NextResponse.json({ error: "Failed to process chat message" }, { status: 500 })
  }
}
