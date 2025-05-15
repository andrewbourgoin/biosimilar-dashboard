// FDA Approval Overview – Fix reference selection to show correct product sets

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

  useEffect(() => {
    async function fetchData() {
      const { data: productsData } = await supabase
        .from('biosimilar_products')
        .select('*');

      const { data: presentationsData } = await supabase
        .from('presentations')
        .select('*');

      const referenceSet = productsData
        .filter(p => p.bla_type === '351(a)')
        .map(p => p.proprietary_name);

      const grouped = presentationsData?.reduce((acc, pres) => {
        if (!acc[pres.product_id]) acc[pres.product_id] = [];
        acc[pres.product_id].push(pres);
        return acc;
      }, {});

      setProducts(productsData || []);
      setPresentationsMap(grouped || {});
      setReferenceProducts(referenceSet);
      setSelectedRef(referenceSet[0] || '');
      setLoading(false);
    }
    fetchData();
  }, []);

  const referenceProduct = products.find(p => p.proprietary_name === selectedRef && p.bla_type === '351(a)');

  const filtered = referenceProduct
    ? Array.from(
        new Map(
          products
            .filter(p => (p.reference_product === referenceProduct.proprietary_name || p.id === referenceProduct.id) && (presentationsMap[p.id] && presentationsMap[p.id].length > 0))
            .sort((a, b) => {
              if (a.id === referenceProduct.id) return -1;
              if (b.id === referenceProduct.id) return 1;
              const aPres = presentationsMap[a.id]?.filter(p => p.approved)?.length || 0;
              const bPres = presentationsMap[b.id]?.filter(p => p.approved)?.length || 0;
              return bPres - aPres;
            })
            .map(p => [p.proprietary_name, p])
        ).values()
      )
    : [];

  const allPresentations = Array.from(
  new Set(
    filtered.flatMap(p =>
      (presentationsMap[p.id] || []).map(pr => pr.name)
    )
  )
).sort();

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
          {referenceProducts.map((ref, idx) => (
            <button
              key={idx}
              className={`market-tile ${ref === selectedRef ? 'active' : ''}`}
              onClick={() => setSelectedRef(ref)}
            >
              {ref}
            </button>
          ))}
        </div>

        <div className="main-content-area">
          <h1>{selectedRef} Market FDA Approval Overview</h1>
          {loading ? (
            <p>Loading...</p>
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
                  {filtered.map((product) => (
                    <tr
                      key={product.id}
                      className={product.bla_type === '351(a)' ? 'reference-product-row' : ''}
                    >
                      <td>{product.proprietary_name}</td>
                      <td>{product.applicant}</td>
                      {allPresentations.map((pres, idx) => {
                        const match = (presentationsMap[product.id] || []).find(p => p.name === pres);
                        let cls = 'status-unknown';
                        if (match) {
                          if (product.bla_type === '351(a)') cls = 'status-reference';
                          else if (match.marketing_status === 'Discontinued') cls = 'status-discontinued';
                          else if (!match.approved) cls = 'status-unknown';
                          else if (match.approved && match.interchangeable) cls = 'status-interchangeable';
                          else cls = 'status-biosimilar';
                        }
                        const label = product.bla_type === '351(a)'
                          ? 'R'
                          : match?.marketing_status === 'Discontinued'
                          ? 'D'
                          : match?.approved && match?.interchangeable
                          ? 'I'
                          : 'B';
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
