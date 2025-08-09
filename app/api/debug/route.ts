import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check environment variables
    const sasUrl = process.env.SASURL || process.env.SAS_URL
    const fallbackUrl =
      "https://rohitproductstore.blob.core.windows.net/products/Final_dataset.csv?sp=r&st=2025-08-09T21:26:23Z&se=2025-09-30T05:41:23Z&spr=https&sv=2024-11-04&sr=b&sig=W%2BmEkqLEp8j230HSyit1bFHCfAWhyQQv6U3tgS7x72Q%3D"

    const azureSasUrl = sasUrl || fallbackUrl

    console.log("🔍 Debug: Starting environment and fetch test")

    // Test the fetch
    const response = await fetch(azureSasUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProductGrid/1.0)",
        Accept: "text/csv, text/plain, */*",
        "Cache-Control": "no-cache",
      },
    })

    console.log(`📡 Debug: Response status: ${response.status}`)

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        environmentVariables: {
          SASURL: process.env.SASURL ? "Available" : "Missing",
          SAS_URL: process.env.SAS_URL ? "Available" : "Missing",
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL ? "Running on Vercel" : "Not on Vercel",
        },
        urlUsed: sasUrl ? "Environment Variable" : "Fallback",
        urlLength: azureSasUrl.length,
      })
    }

    // Get response text
    const responseText = await response.text()

    // Get first few lines to analyze structure
    const lines = responseText.trim().split("\n")
    const firstFewLines = lines.slice(0, 5)

    return NextResponse.json({
      success: true,
      environmentVariables: {
        SASURL: process.env.SASURL ? "Available" : "Missing",
        SAS_URL: process.env.SAS_URL ? "Available" : "Missing",
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL ? "Running on Vercel" : "Not on Vercel",
      },
      fetchDetails: {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
        urlUsed: sasUrl ? "Environment Variable" : "Fallback",
        urlLength: azureSasUrl.length,
      },
      csvAnalysis: {
        totalLength: responseText.length,
        totalLines: lines.length,
        firstFewLines: firstFewLines,
        startsWithHTML: responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html"),
        isEmpty: !responseText.trim(),
        headerLine: lines[0] || "No header found",
        sampleDataLine: lines[1] || "No data line found",
      },
    })
  } catch (error) {
    console.error("❌ Debug endpoint error:", error)

    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      environmentVariables: {
        SASURL: process.env.SASURL ? "Available" : "Missing",
        SAS_URL: process.env.SAS_URL ? "Available" : "Missing",
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL ? "Running on Vercel" : "Not on Vercel",
      },
    })
  }
}
