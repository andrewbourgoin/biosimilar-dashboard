// pages/index.js or your main FDAApprovalOverview component file
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function FDAApprovalOverview() {
  const [allProducts, setAllProducts] = useState([]);
  const [allProductDetails, setAllProductDetails] = useState([]);
  const [allApplicants, setAllApplicants] = useState([]);
  const [allReferenceProductsMaster, setAllReferenceProductsMaster] = useState([]);

  const [marketTiles, setMarketTiles] = useState([]);
  const [selectedMarketTile, setSelectedMarketTile] = useState(""); // Stores ref_product_proprietary_name

  const [tableHeaders, setTableHeaders] = useState([]); // Dynamic presentation headers
  const [tableRows, setTableRows] = useState([]); // Data for the main table

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initial data fetch for all necessary tables
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoading(true);
        setError(null);

        const { data: applicantsData, error: applicantsError } = await supabase
          .from("applicants")
          .select("*");
        if (applicantsError) throw new Error(`Fetching applicants: ${applicantsError.message}`);
        setAllApplicants(applicantsData || []);

        const { data: refProductsMasterData, error: refProductsMasterError } = await supabase
          .from("reference_products")
          .select("*");
        if (refProductsMasterError) throw new Error(`Fetching reference_products master: ${refProductsMasterError.message}`);
        setAllReferenceProductsMaster(refProductsMasterData || []);

        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("*");
        if (productsError) throw new Error(`Fetching products: ${productsError.message}`);
        setAllProducts(productsData || []);

        const { data: productDetailsData, error: productDetailsError } = await supabase
          .from("product_details")
          .select("*");
        if (productDetailsError) throw new Error(`Fetching product_details: ${productDetailsError.message}`);
        setAllProductDetails(productDetailsData || []);

      } catch (err) {
        console.error("Error fetching initial data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  // Effect to determine market tiles (reference products with biosimilars)
  useEffect(() => {
    if (allProducts.length > 0 && allReferenceProductsMaster.length > 0) {
      const biosimilarRefProductIds = new Set(
        allProducts
          .filter(p => p.bla_type && (p.bla_type.includes("351(k) Biosimilar") || p.bla_type.includes("351(k) Interchangeable")))
          .map(p => p.ref_product_id)
          .filter(id => id !== null)
      );

      const tiles = allReferenceProductsMaster
        .filter(rp => biosimilarRefProductIds.has(rp.ref_product_id))
        .map(rp => rp.ref_product_proprietary_name)
        .sort(); 
      
      setMarketTiles(tiles);
      if (tiles.length > 0 && !selectedMarketTile) {
        setSelectedMarketTile(tiles[0]);
      }
    }
  }, [allProducts, allReferenceProductsMaster, selectedMarketTile]);

  // Effect to update table when a market tile is selected or data changes
  useEffect(() => {
    if (!selectedMarketTile || allProducts.length === 0 || allProductDetails.length === 0 || allApplicants.length === 0 || allReferenceProductsMaster.length === 0) {
      setTableHeaders([]);
      setTableRows([]);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Find the selected master reference product entry
      const selectedMasterRefProduct = allReferenceProductsMaster.find(
        rp => rp.ref_product_proprietary_name === selectedMarketTile
      );
      if (!selectedMasterRefProduct) throw new Error(`Master reference product ${selectedMarketTile} not found.`);

      // Find the actual reference product entry in the 'products' table
      const actualRefProductEntry = allProducts.find(
        p => p.proprietary_name === selectedMarketTile && p.bla_type === "351(a)"
      );
      if (!actualRefProductEntry) throw new Error(`Actual reference product entry for ${selectedMarketTile} (351(a)) not found in products table.`);

      // 1. Determine Dynamic Table Headers (Presentations of the selected Reference Product)
      const refProductPresentationsDetails = allProductDetails.filter(
        pd => pd.product_id === actualRefProductEntry.product_id
      );
      
      const uniquePresentations = Array.from(
        new Set(
          refProductPresentationsDetails.map(pd => `${pd.Strength} ${pd.product_presentation}`.trim())
        )
      ).sort(); 
      setTableHeaders(uniquePresentations);

      // 2. Prepare Table Rows
      const rows = [];

      // 2a. Add the Reference Product Row
      const refApplicant = allApplicants.find(app => app.applicant_id === actualRefProductEntry.applicant_id);
      const refRow = {
        isReference: true,
        proprietaryName: actualRefProductEntry.proprietary_name,
        applicantName: refApplicant ? refApplicant.Applicant : "N/A",
        presentations: {},
      };
      uniquePresentations.forEach(header => {
        const detail = refProductPresentationsDetails.find(pd => `${pd.Strength} ${pd.product_presentation}`.trim() === header);
        refRow.presentations[header] = detail ? "R" : ""; // Black R
      });
      rows.push(refRow);

      // 2b. Add Biosimilar/Interchangeable Rows
      const relatedBiosimilars = allProducts.filter(
        p => p.ref_product_id === selectedMasterRefProduct.ref_product_id && 
             p.product_id !== actualRefProductEntry.product_id && // Exclude the ref product itself
             p.bla_type && (p.bla_type.includes("351(k) Biosimilar") || p.bla_type.includes("351(k) Interchangeable"))
      );

      relatedBiosimilars.forEach(bioProduct => {
        const bioApplicant = allApplicants.find(app => app.applicant_id === bioProduct.applicant_id);
        const bioRow = {
          isReference: false,
          proprietaryName: bioProduct.proprietary_name,
          applicantName: bioApplicant ? bioApplicant.Applicant : "N/A",
          presentations: {},
        };
        const bioProductDetails = allProductDetails.filter(pd => pd.product_id === bioProduct.product_id);
        
        uniquePresentations.forEach(header => {
          const detail = bioProductDetails.find(pd => `${pd.Strength} ${pd.product_presentation}`.trim() === header);
          if (detail) {
            if (detail.marketing_status === "Disc" || detail.marketing_status === "Discontinued") {
              bioRow.presentations[header] = "d"; // Grey d
            } else if (bioProduct.bla_type.includes("351(k) Interchangeable")) {
              bioRow.presentations[header] = "I"; // Green I
            } else if (bioProduct.bla_type.includes("351(k) Biosimilar")) {
              bioRow.presentations[header] = "B"; // Blue B
            }
          } else {
            bioRow.presentations[header] = "";
          }
        });
        rows.push(bioRow);
      });
      
      setTableRows(rows);

    } catch (err) {
      console.error(`Error processing data for ${selectedMarketTile}:`, err);
      setError(err.message);
      setTableRows([]);
      setTableHeaders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMarketTile, allProducts, allProductDetails, allApplicants, allReferenceProductsMaster]);

  if (error && !loading) { // Show general error if initial load failed, or specific error if processing tile failed
    return (
      <div className="page-wrapper">
         <header className="header">
            <div className="logo-container">
                <img src="/placeholder-logo.jpg" alt="All Things Biosimilar Logo" className="logo-image" />
            </div>
            <nav className="navigation-menu">
                <span className="menu-placeholder">FDA Approval Overview</span>
            </nav>
        </header>
        <main className="main-content-area">
            <div className="error-container">
                <h2>Error Loading Data</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Try Again</button>
            </div>
        </main>
        <footer><p>© {new Date().getFullYear()} Bourgoin Insights Group. All rights reserved.</p></footer>
      </div>
    );
  }
  
  return (
    <div className="page-wrapper">
      <header className="header">
        <div className="logo-container">
          {/* Replace with your actual logo if available, or a placeholder */}
          <img src="/placeholder-logo.jpg" alt="All Things Biosimilar Logo" className="logo-image" />
        </div>
        <nav className="navigation-menu">
          {/* You can add actual navigation links here if needed */}
          <span className="menu-placeholder">FDA Approval Overview</span>
        </nav>
      </header>

      <main className="main-content-area">
        <section className="intro-section">
          <div className="intro-logo-container">
             <img src="/placeholder-logo.jpg" className="intro-logo-image" alt="Intro Logo" />
          </div>
          <div className="intro-text-container">
            <h2>Navigating the Biosimilar Landscape</h2>
            <p>This tool provides an overview of the FDA-approved biosimilars for various reference products. Select a reference product below to view its competitive landscape, including approved biosimilars, their applicants, and key characteristics.</p>
            <div className="legend-container">
              <h3>Legend:</h3>
              <ul className="legend-list">
                <li><span className="cell-status-label status-reference">R</span> = Reference Product</li>
                <li><span className="cell-status-label status-biosimilar">B</span> = Biosimilar</li>
                <li><span className="cell-status-label status-interchangeable">I</span> = Interchangeable</li>
                <li><span className="cell-status-label status-discontinued">d</span> = Discontinued</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="market-selection-area">
          {loading && marketTiles.length === 0 ? (
            <div className="loading-indicator">Loading reference products...</div>
          ) : marketTiles.length > 0 ? (
            marketTiles.map((tileName) => (
              <button
                key={tileName}
                className={`market-tile ${tileName === selectedMarketTile ? "active" : ""}`}
                onClick={() => setSelectedMarketTile(tileName)}
              >
                {tileName}
              </button>
            ))
          ) : (
             !loading && <div className="no-data-message">No reference products with biosimilars found.</div>
          )}
        </section>

        <section className="main-table-section">
          {selectedMarketTile && <h1>{selectedMarketTile} Market FDA Approval Overview</h1>}
          {loading && selectedMarketTile ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading product data for {selectedMarketTile}...</p>
            </div>
          ) : error && selectedMarketTile ? (
             <div className="error-container">
                <h2>Error Loading Data for {selectedMarketTile}</h2>
                <p>{error}</p>
            </div>
          ) : tableRows.length > 0 && tableHeaders.length > 0 ? (
            <div className="table-container">
              <table id="comparison-table">
                <thead>
                  <tr style={{ backgroundColor: "#1e3a8a", color: "white" }}> 
                    <th>Proprietary Name</th>
                    <th>Applicant</th>
                    {tableHeaders.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, rowIndex) => (
                    <tr key={rowIndex} style={{ backgroundColor: row.isReference ? "#f0f0f0" : "white" }}>
                      <td>{row.proprietaryName}</td>
                      <td>{row.applicantName}</td>
                      {tableHeaders.map((header) => {
                        const status = row.presentations[header] || "";
                        let className = "";
                        if (status === "R") className = "status-reference";
                        else if (status === "B") className = "status-biosimilar";
                        else if (status === "I") className = "status-interchangeable";
                        else if (status === "d") className = "status-discontinued";
                        
                        return (
                          <td key={header}>
                            {status && <span className={`cell-status-label ${className}`}>{status}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedMarketTile && !loading && !error ? (
            <div className="no-data-message">No data available for {selectedMarketTile}.</div>
          ) : null}
        </section>
      </main>

      <footer>
        <p>© {new Date().getFullYear()} Bourgoin Insights Group. All rights reserved.</p>
      </footer>
    </div>
  );
}

