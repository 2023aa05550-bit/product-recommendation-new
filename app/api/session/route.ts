import { type NextRequest, NextResponse } from "next/server"

// Module-level variable to store latest recommendations
const latestRecommendations: any[] = []

let liveSessionData: any = {
  session_id: "",
  itemlist: [],
  sessionMetadata: {
    startTime: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    pageViews: 0,
    totalDwellTime: 0,
    deviceType: "desktop",
    userAgent: "Mozilla/5.0 (compatible; ProductGrid/1.0)",
    referrer: "https://google.com",
  },
}

export function updateLiveSession(sessionData: any) {
  liveSessionData = {
    ...sessionData,
    sessionMetadata: {
      ...liveSessionData.sessionMetadata,
      lastActivity: new Date().toISOString(),
      pageViews: liveSessionData.sessionMetadata.pageViews + 1,
      totalDwellTime:
        sessionData.itemlist?.reduce((total: number, item: any) => total + (item["dwell time"] || 0), 0) || 0,
    },
  }
  console.log("📊 Live session data updated:", {
    sessionId: liveSessionData.session_id,
    itemCount: liveSessionData.itemlist?.length || 0,
    totalDwellTime: liveSessionData.sessionMetadata.totalDwellTime,
  })
}

export async function GET(request: NextRequest) {
  try {
    console.log("📊 Session API called - returning live session data")

    const responseData = {
      sessionId: liveSessionData.session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId: `user_${Math.random().toString(36).substr(2, 8)}`,
      products:
        liveSessionData.itemlist?.map((item: any, index: number) => ({
          id: item.product,
          name: item["product name"],
          description: item.description,
          category: "Electronics", // Default category since not tracked in current structure
          price: 0, // Price not tracked in current structure
          engagement: item.engagement,
          dwellTime: item["dwell time"],
          addedToCart: item.added_to_cart,
          productPopularity: item["product popularity"],
          netFeedback: item.net_feedback,
          image: item.image,
          eventSequenceNumber: item.event_sequence_number,
        })) || [],
      sessionMetadata: liveSessionData.sessionMetadata,
      recommendations: latestRecommendations.length > 0 ? latestRecommendations : null,
    }

    console.log(`📊 Live session response prepared:`)
    console.log(`   - Session ID: ${responseData.sessionId}`)
    console.log(`   - Products: ${responseData.products.length}`)
    console.log(`   - Recommendations: ${latestRecommendations.length}`)
    console.log(`   - Total Dwell Time: ${liveSessionData.sessionMetadata.totalDwellTime}s`)

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

export async function POST(request: NextRequest) {
  try {
    const sessionData = await request.json()
    updateLiveSession(sessionData)

    return NextResponse.json(
      {
        success: true,
        message: "Session data updated",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("❌ Error updating session data:", error)
    return NextResponse.json(
      {
        error: "Failed to update session data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Export the latestRecommendations for use in other modules if needed
export { latestRecommendations }
