// FDA Approval Overview – Enhanced version with error handling and filtering

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function FDAApprovalOverview() {
  const [products, setProducts] = useState([]);
  const [presentationsMap, setPresentationsMap] = useState({});
  const [referenceProducts, setReferenceProducts] = useState([]);
  const [selectedRef, setSelectedRef] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // Get all products
        const { data: productsData, error: productsError } = await supabase
          .from('biosimilar_products')
          .select('*');
          
        if (productsError) throw new Error(`Error fetching products: ${productsError.message}`);
        
        // Get all presentations
        const { data: presentationsData, error: presentationsError } = await supabase
          .from('presentations')
          .select('*');
          
        if (presentationsError) throw new Error(`Error fetching presentations: ${presentationsError.message}`);
        
        // Find reference products that have biosimilars
        const referenceSet = new Set();
        const biosimilarReferenceProducts = new Set();
        
        // First identify all reference products
        const referenceProducts = productsData.filter(p => p.bla_type === '351(a)');
        
        // Then identify which reference products have biosimilars
        productsData.forEach(product => {
          if (product.bla_type.includes('351(k)')) {
            biosimilarReferenceProducts.add(product.reference_product);
          }
        });
        
        // Only include reference products that have biosimilars
        referenceProducts.forEach(refProduct => {
          if (biosimilarReferenceProducts.has(refProduct.reference_product)) {
            referenceSet.add(refProduct.proprietary_name);
          }
        });
        
        const referenceArray = Array.from(referenceSet);
        
        // Group presentations by product_id
        const grouped = presentationsData?.reduce((acc, pres) => {
          if (!acc[pres.product_id]) acc[pres.product_id] = [];
          acc[pres.product_id].push(pres);
          return acc;
        }, {});

        setProducts(productsData || []);
        setPresentationsMap(grouped || {});
        setReferenceProducts(referenceArray);
        setSelectedRef(referenceArray[0] || '');
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  const referenceProduct = products.find(
    (p) => p.proprietary_name === selectedRef && p.bla_type === '351(a)'
  );

  const filtered = referenceProduct
    ? products.filter(
        (p) =>
          p.reference_product === referenceProduct.reference_product ||
          (p.bla_type === '351(a)' &&
            p.proprietary_name === referenceProduct.proprietary_name)
      )
    : [];

  const deduped = Array.from(
    new Map(
      filtered.map((p) => [
        `${p.proprietary_name.trim().toLowerCase()}|${p.applicant.trim().toLowerCase()}`,
        p,
      ])
    ).values()
  ).sort((a, b) => {
    if (a.bla_type === '351(a)') return -1;
    if (b.bla_type === '351(a)') return 1;
    const aPres = presentationsMap[a.id]?.length || 0;
    const bPres = presentationsMap[b.id]?.length || 0;
    return bPres - aPres;
  });

  const allPresentations = Array.from(
    new Set(
      deduped.flatMap((p) =>
        (presentationsMap[p.id] || []).map((pres) => pres.name)
      )
    )
  ).sort();

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="header">
        <div className="logo-container">
          <img src="/placeholder-logo.jpg" alt="Logo" className="logo-image" />
        </div>
        <div className="navigation-menu">
          <span className="menu-placeholder">FDA Approval Overview</span>
        </div>
      </header>

      <main className="main-content-area">
        <div className="intro-section">
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
                <li><span className="cell-status-label status-discontinued">D</span> = Discontinued</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="market-selection-area">
          {loading ? (
            <div className="loading-indicator">Loading reference products...</div>
          ) : (
            referenceProducts.map((ref, idx) => (
              <button
                key={idx}
                className={`market-tile ${ref === selectedRef ? 'active' : ''}`}
                onClick={() => setSelectedRef(ref)}
              >
                {ref}
              </button>
            ))
          )}
        </div>

        <div className="main-content-area">
          <h1>{selectedRef} Market FDA Approval Overview</h1>
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading product data...</p>
            </div>
          ) : (
            <div className="table-container">
              <table id="comparison-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Applicant</th>
                    {allPresentations.map((pres, i) => (
                      <th key={i}>{pres}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deduped.map((product) => (
                    <tr
                      key={product.id}
                      className={product.bla_type === '351(a)' ? 'reference-product-row' : ''}
                    >
                      <td>{product.proprietary_name}</td>
                      <td>{product.applicant}</td>
                      {allPresentations.map((pres, idx) => {
                        const match = (presentationsMap[product.id] || []).find(
                          (p) => p.name === pres
                        );

                        let cls = 'status-unknown';
                        let label = '';

                        if (product.bla_type === '351(a)') {
                          cls = 'status-reference';
                          label = 'R';
                        } else if (match) {
                          if (match.marketing_status === 'Discontinued' || match.marketing_status === 'Disc') {
                            cls = 'status-discontinued';
                            label = 'D';
                          } else if (product.bla_type.toLowerCase().includes('interchangeable')) {
                            cls = 'status-interchangeable';
                            label = 'I';
                          } else {
                            cls = 'status-biosimilar';
                            label = 'B';
                          }
                        }

                        return (
                          <td key={idx}>
                            <span className={`cell-status-label ${cls}`}>{match ? label : ''}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer>
        <p>© {new Date().getFullYear()} Bourgoin Insights Group. All rights reserved.</p>
      </footer>
    </div>
  );
}

