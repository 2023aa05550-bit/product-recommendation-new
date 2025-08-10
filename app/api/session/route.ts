import { type NextRequest, NextResponse } from "next/server"

// Module-level variable to store latest recommendations
const latestRecommendations: any[] = []

// Simulated session data - replace with real session logic later
function generateSimulatedSession() {
  return {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: `user_${Math.random().toString(36).substr(2, 8)}`,
    products: [
      {
        id: "session-product-1",
        name: "Wireless Bluetooth Headphones",
        description: "Premium noise-cancelling wireless headphones with 30-hour battery life",
        category: "Electronics",
        price: 199.99,
        engagement: "click",
        dwellTime: 45,
        addedToCart: 0,
        productPopularity: 1250,
        netFeedback: 890,
        image: "/placeholder.svg?height=300&width=300",
        eventSequenceNumber: 1,
      },
      {
        id: "session-product-2",
        name: "Smart Fitness Watch",
        description: "Advanced fitness tracking with heart rate monitor and GPS",
        category: "Electronics",
        price: 299.99,
        engagement: "hover",
        dwellTime: 12,
        addedToCart: 1,
        productPopularity: 980,
        netFeedback: 720,
        image: "/placeholder.svg?height=300&width=300",
        eventSequenceNumber: 2,
      },
      {
        id: "session-product-3",
        name: "Organic Coffee Beans",
        description: "Single-origin organic coffee beans, medium roast",
        category: "Food & Beverage",
        price: 24.99,
        engagement: "share",
        dwellTime: 8,
        addedToCart: 0,
        productPopularity: 650,
        netFeedback: 480,
        image: "/placeholder.svg?height=300&width=300",
        eventSequenceNumber: 3,
      },
      {
        id: "session-product-4",
        name: "Yoga Mat - Eco-Friendly",
        description: "Non-slip yoga mat made from natural rubber, 6mm thick",
        category: "Sports & Fitness",
        price: 49.99,
        engagement: "click",
        dwellTime: 23,
        addedToCart: 1,
        productPopularity: 420,
        netFeedback: 350,
        image: "/placeholder.svg?height=300&width=300",
        eventSequenceNumber: 4,
      },
    ],
    sessionMetadata: {
      startTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
      lastActivity: new Date().toISOString(),
      pageViews: 8,
      totalDwellTime: 88,
      deviceType: "desktop",
      userAgent: "Mozilla/5.0 (compatible; ProductGrid/1.0)",
      referrer: "https://google.com",
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("📊 Session API called - generating simulated session data")

    // Generate simulated session data
    const sessionData = generateSimulatedSession()

    // Add latest recommendations if available
    const responseData = {
      ...sessionData,
      recommendations: latestRecommendations.length > 0 ? latestRecommendations : null,
    }

    console.log(`📊 Session response prepared:`)
    console.log(`   - Session ID: ${sessionData.sessionId}`)
    console.log(`   - Products: ${sessionData.products.length}`)
    console.log(`   - Recommendations: ${latestRecommendations.length}`)
    console.log(`   - Timestamp: ${sessionData.timestamp}`)

    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    console.error("❌ Error in session API:", error)

    return NextResponse.json(
      {
        error: "Failed to retrieve session data",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// Export the latestRecommendations for use in other modules if needed
export { latestRecommendations }
