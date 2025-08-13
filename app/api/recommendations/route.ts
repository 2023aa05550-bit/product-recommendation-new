import { type NextRequest, NextResponse } from "next/server"

// Import the shared latestRecommendations variable from session route
import { latestRecommendations } from "../session/route"

interface RecommendationItem {
  rank: number
  similarity_score: number
  id: string
  name: string
  category: string
  price: number
  image: string // base64 encoded image
  description: string
}

interface RecommendationsRequest {
  recommendations: RecommendationItem[]
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎯 Recommendations API called - processing incoming recommendations")

    // Parse the request body
    let body: RecommendationsRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError)
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          details: "Request body must be valid JSON",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    // Validate that recommendations array exists
    if (!body.recommendations || !Array.isArray(body.recommendations)) {
      console.error("❌ Invalid recommendations format:", body)
      return NextResponse.json(
        {
          error: "Invalid recommendations format",
          details: "Request body must contain a 'recommendations' array",
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    for (const rec of body.recommendations) {
      if (
        typeof rec.rank !== "number" ||
        typeof rec.similarity_score !== "number" ||
        !rec.id ||
        !rec.name ||
        !rec.category ||
        typeof rec.price !== "number" ||
        !rec.image ||
        !rec.description
      ) {
        console.error("❌ Invalid recommendation item format:", rec)
        return NextResponse.json(
          {
            error: "Invalid recommendation item format",
            details:
              "Each recommendation must have: rank (number), similarity_score (number), id (string), name (string), category (string), price (number), image (base64 string), description (string)",
            timestamp: new Date().toISOString(),
          },
          { status: 400 },
        )
      }
    }

    console.log(`📥 Received ${body.recommendations.length} recommendations:`)
    body.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec.name} (${rec.category})`)
      console.log(`      Rank: ${rec.rank}, Similarity: ${rec.similarity_score}`)
      console.log(`      Price: $${rec.price}`)
      console.log(`      ID: ${rec.id}`)
    })

    // Store recommendations in memory (replace the entire array)
    latestRecommendations.length = 0 // Clear existing recommendations
    latestRecommendations.push(...body.recommendations) // Add new recommendations

    const timestampedRecommendations = latestRecommendations.map((rec) => ({
      ...rec,
      receivedAt: new Date().toISOString(),
    }))

    // Update the stored recommendations with timestamps
    latestRecommendations.length = 0
    latestRecommendations.push(...timestampedRecommendations)

    console.log(`✅ Successfully stored ${latestRecommendations.length} recommendations in memory`)

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Recommendations received and stored successfully",
        count: body.recommendations.length,
        timestamp: new Date().toISOString(),
        storedRecommendations: latestRecommendations.length,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("❌ Error in recommendations API:", error)

    return NextResponse.json(
      {
        error: "Failed to process recommendations",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// Also support GET method to retrieve current recommendations
export async function GET(request: NextRequest) {
  try {
    console.log("📊 Recommendations GET API called - retrieving stored recommendations")

    return NextResponse.json(
      {
        recommendations: latestRecommendations,
        count: latestRecommendations.length,
        timestamp: new Date().toISOString(),
        message:
          latestRecommendations.length > 0 ? "Retrieved stored recommendations" : "No recommendations currently stored",
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("❌ Error retrieving recommendations:", error)

    return NextResponse.json(
      {
        error: "Failed to retrieve recommendations",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
