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

function getAboutProduct(product: any): string {
  const aboutFields = [
    "about",
    "About",
    "ABOUT",
    "about_product",
    "aboutProduct",
    "AboutProduct",
    "ABOUT_PRODUCT",
    "product_about",
    "productAbout",
    "ProductAbout",
    "PRODUCT_ABOUT",
    "details",
    "Details",
    "DETAILS",
    "specifications",
    "Specifications",
    "SPECIFICATIONS",
    "features",
    "Features",
    "FEATURES",
    "overview",
    "Overview",
    "OVERVIEW",
    "summary",
    "Summary",
    "SUMMARY",
    "info",
    "Info",
    "INFO",
    "product_info",
    "productInfo",
    "ProductInfo",
    "PRODUCT_INFO",
    "long_description",
    "longDescription",
    "LongDescription",
    "LONG_DESCRIPTION",
    "extended_description",
    "extendedDescription",
    "ExtendedDescription",
    "EXTENDED_DESCRIPTION",
  ]

  for (const field of aboutFields) {
    if (product[field] && typeof product[field] === "string" && product[field].trim()) {
      return product[field].trim()
    }
  }

  // Fallback to description if no specific "about" field found
  return product.description || "No additional product information available"
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
      session_id: liveSessionData.session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemlist:
        liveSessionData.itemlist?.map((item: any, index: number) => ({
          product: item.product || item.id || `product_${index}`,
          "product name": item["product name"] || item.name || `Product ${index + 1}`,
          description: item.description || "No description available",
          category: item.category || item.categories?.[0] || "General",
          "about product": getAboutProduct(item),
          engagement: item.engagement || "click",
          "dwell time": item["dwell time"] || 0,
          wishlisted: item.wishlisted || 0,
          added_to_cart: item.added_to_cart || 0,
          "product popularity": item["product popularity"] || item.popularity || 0,
          net_feedback: item.net_feedback || 0,
          image: item.image || null,
          event_sequence_number: item.event_sequence_number || index + 1,
        })) || [],
    }

    console.log(`📊 Live session response prepared:`)
    console.log(`   - Session ID: ${responseData.session_id}`)
    console.log(`   - Items: ${responseData.itemlist.length}`)
    console.log(`   - Format: Updated to new specification`)

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
