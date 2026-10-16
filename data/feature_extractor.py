"""
Molecular Descriptor and Fingerprint Extraction Module
Extracts Morgan fingerprints, 2D physicochemical descriptors, and symmetric drug-pair combination features.
"""

import re
import numpy as np
import pandas as pd

# Check RDKit availability
try:
    from rdkit import Chem, RDLogger
    from rdkit.Chem import Descriptors, rdMolDescriptors
    try:
        from rdkit.Chem import rdFingerprintGenerator
        MORGAN_GEN = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=256)
    except Exception:
        from rdkit.Chem import AllChem
        MORGAN_GEN = None
    RDLogger.DisableLog('rdApp.*')
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    print("Warning: RDKit not found in environment. Using fallback molecular descriptor engine.")


class MolecularFeatureExtractor:
    def __init__(self, n_bits=256, radius=2):
        self.n_bits = n_bits
        self.radius = radius
        self.descriptor_names = [
            "MolWt", "LogP", "TPSA", "HBD", "HBA", 
            "NumRotatableBonds", "FractionCSP3", "RingCount",
            "AromaticRings", "HeavyAtomCount"
        ]

    def smiles_to_descriptors_rdkit(self, smiles: str) -> np.ndarray:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return np.zeros(self.n_bits + len(self.descriptor_names), dtype=np.float32)
        
        # 1. Morgan Fingerprint (ECFP)
        if MORGAN_GEN is not None:
            fp = MORGAN_GEN.GetFingerprint(mol)
            fp_arr = np.zeros(self.n_bits, dtype=np.float32)
            for bit in fp.GetOnBits():
                if bit < self.n_bits:
                    fp_arr[bit] = 1.0
        else:
            from rdkit.Chem import AllChem
            fp = AllChem.GetMorganFingerprintAsBitVect(mol, self.radius, nBits=self.n_bits)
            fp_arr = np.zeros(self.n_bits, dtype=np.float32)
            for bit in fp.GetOnBits():
                fp_arr[bit] = 1.0


        # 2. 2D Physicochemical Descriptors
        desc_vals = [
            float(Descriptors.MolWt(mol)),
            float(Descriptors.MolLogP(mol)),
            float(Descriptors.TPSA(mol)),
            float(rdMolDescriptors.CalcNumHBD(mol)),
            float(rdMolDescriptors.CalcNumHBA(mol)),
            float(Descriptors.NumRotatableBonds(mol)),
            float(Descriptors.FractionCSP3(mol)),
            float(rdMolDescriptors.CalcNumRings(mol)),
            float(rdMolDescriptors.CalcNumAromaticRings(mol)),
            float(mol.GetNumHeavyAtoms())
        ]
        desc_arr = np.array(desc_vals, dtype=np.float32)
        return np.concatenate([fp_arr, desc_arr])

    def smiles_to_descriptors_fallback(self, smiles: str) -> np.ndarray:
        """Pure Python fallback for molecular property extraction if RDKit is not installed."""
        vec = np.zeros(self.n_bits + len(self.descriptor_names), dtype=np.float32)
        if not smiles or not isinstance(smiles, str):
            return vec
        
        # Atom counting heuristics
        c_count = smiles.count("C") + smiles.count("c")
        n_count = smiles.count("N") + smiles.count("n")
        o_count = smiles.count("O") + smiles.count("o")
        s_count = smiles.count("S") + smiles.count("s")
        f_count = smiles.count("F")
        cl_count = smiles.count("Cl")
        br_count = smiles.count("Br")
        heavy_atoms = c_count + n_count + o_count + s_count + f_count + cl_count + br_count
        
        est_molwt = (c_count * 12.011 + n_count * 14.007 + o_count * 15.999 + 
                     s_count * 32.065 + f_count * 18.998 + cl_count * 35.45 + br_count * 79.904)
        est_logp = (c_count * 0.25 - (o_count + n_count) * 0.5 + cl_count * 0.6)
        est_tpsa = (o_count * 18.0 + n_count * 12.0)
        est_hbd = smiles.count("OH") + smiles.count("NH")
        est_hba = o_count + n_count
        est_rings = len(re.findall(r"\d", smiles)) // 2
        aromatic_count = smiles.count("c") + smiles.count("n") + smiles.count("o")
        
        # Hash pseudo-fingerprints based on character shingles
        for i in range(len(smiles) - 2):
            sub = smiles[i:i+3]
            bit = hash(sub) % self.n_bits
            vec[bit] = 1.0

        desc_vals = [
            est_molwt, est_logp, est_tpsa, float(est_hbd), float(est_hba),
            float(smiles.count("-") + smiles.count("=")), 0.3, float(est_rings),
            float(aromatic_count // 6), float(heavy_atoms)
        ]
        vec[self.n_bits:] = np.array(desc_vals, dtype=np.float32)
        return vec

    def get_single_drug_features(self, smiles: str) -> np.ndarray:
        if RDKIT_AVAILABLE:
            try:
                return self.smiles_to_descriptors_rdkit(smiles)
            except Exception:
                return self.smiles_to_descriptors_fallback(smiles)
        else:
            return self.smiles_to_descriptors_fallback(smiles)

    def build_pair_features(self, smiles_1: str, smiles_2: str, 
                            log_ac50_1: float = -6.0, log_ac50_2: float = -6.0) -> np.ndarray:
        """
        Builds order-invariant symmetric combination features:
        [v1 + v2, |v1 - v2|, v1 * v2, min(ac50), max(ac50), |ac50_1 - ac50_2|]
        """
        v1 = self.get_single_drug_features(smiles_1)
        v2 = self.get_single_drug_features(smiles_2)
        
        sum_feat = v1 + v2
        diff_feat = np.abs(v1 - v2)
        prod_feat = v1 * v2
        
        ac1 = float(log_ac50_1) if pd.notna(log_ac50_1) else -6.0
        ac2 = float(log_ac50_2) if pd.notna(log_ac50_2) else -6.0
        
        potency_feat = np.array([
            min(ac1, ac2),
            max(ac1, ac2),
            abs(ac1 - ac2),
            ac1 + ac2
        ], dtype=np.float32)
        
        return np.concatenate([sum_feat, diff_feat, prod_feat, potency_feat])

    def get_feature_dimension(self) -> int:
        single_dim = self.n_bits + len(self.descriptor_names)
        return single_dim * 3 + 4

def prepare_feature_matrix(df: pd.DataFrame, extractor: MolecularFeatureExtractor = None):
    if extractor is None:
        extractor = MolecularFeatureExtractor()
        
    X_list = []
    y_list = []
    labels = []
    
    for idx, row in df.iterrows():
        s1 = str(row["Structure 1"])
        s2 = str(row["Structure 2"])
        ac1 = row.get("Log AC50 (M) 1", -6.0)
        ac2 = row.get("Log AC50 (M) 2", -6.0)
        gamma = float(row["Gamma"])
        label = int(row.get("Label", 0)) if pd.notna(row.get("Label")) else (1 if gamma < 1.0 else 0)
        
        feat = extractor.build_pair_features(s1, s2, ac1, ac2)
        X_list.append(feat)
        y_list.append(gamma)
        labels.append(label)
        
    X = np.vstack(X_list)
    y = np.array(y_list, dtype=np.float32)
    labels = np.array(labels, dtype=np.int32)
    return X, y, labels, extractor
