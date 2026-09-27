---
id: chapter-11
source: supplied
module: 5
chapter: 11
title: "Precision, Recall and Search Optimisation"
position: 2
estimated_minutes: 3
required_reading_pct: 90
---

## Learning Objectives

By the end of this chapter, you should be able to:
- Define and calculate precision, recall, and fallout.
- Explain the meaning of TP, FP, FN, and TN.
- Explain the trade-off between precision and recall.
- Apply basic techniques of search optimisation.

## 11.1 Four Possible Outcomes

Every document in a collection, in relation to a given search, falls into one of four possible categories:
- True Positive (TP): the document is relevant and was retrieved.
- False Positive (FP): the document is not relevant, but was retrieved anyway.
- False Negative (FN): the document is relevant, but was not retrieved.
- True Negative (TN): the document is not relevant and was correctly not retrieved.

## 11.2 Precision

Precision answers the question: of everything that was retrieved, how much of it was actually relevant?

## FORMULA

Precision = Relevant Retrieved ÷ Total Retrieved = TP ÷ (TP + FP)

## 11.3 Recall

Recall answers a different question: of all the relevant documents that exist in the collection, how many of them were actually retrieved?

## FORMULA

Recall = Relevant Retrieved ÷ Total Relevant = TP ÷ (TP + FN)

## 11.4 A Simple Worked Example

Suppose a collection contains 100 relevant documents in total. A search retrieves 20 documents, of which 15 turn out to be relevant.

## CALCULATION

Precision = 15 ÷ 20 = 75%. Recall = 15 ÷ 100 = 15%. This search produced fairly clean results, but it missed a large number of the relevant documents that were actually available.

## 11.5 Fallout

Fallout measures the proportion of non-relevant documents that were retrieved, out of all the non-relevant documents that exist in the collection.

## FORMULA

Fallout = Non-Relevant Retrieved ÷ Total Non-Relevant = FP ÷ (FP + TN)

## 11.6 A Fuller Worked Example

Suppose a collection contains 1,000 documents in total, of which 200 are relevant to a particular search. That search retrieves 100 documents, of which 80 are relevant.

## CALCULATION

Precision = 80 ÷ 100 = 80%. Recall = 80 ÷ 200 = 40%. Non-relevant retrieved = 20; total non-relevant = 800; Fallout = 20 ÷ 800 = 2.5%.

## 11.7 The Precision–Recall Trade-Off

A broad search strategy tends to increase recall, but it often retrieves more irrelevant results along with it, which reduces precision. A narrow search strategy tends to improve precision, but risks missing relevant documents. The appropriate balance between the two depends entirely on the specific information need of the user.

## 11.8 Improving Recall

- Use synonyms and related terms.
- Broaden the search appropriately.
- Use the OR operator.
- Search additional fields, not only the title.
- Make use of controlled-vocabulary relationships such as BT and NT.
- Inspect useful results for additional relevant terminology.

## 11.9 Improving Precision

- Use more specific terms.
- Combine concepts using the AND operator.
- Use phrase searching where it is supported.
- Apply suitable filters.
- Exclude unwanted concepts carefully, using NOT.

## Review Questions

1. A database contains 50 relevant documents. A search retrieves 25 documents, of which 20 are relevant. Calculate the precision and recall.
2. A database contains 500 documents, 100 of which are relevant. A search retrieves 50 documents, of which 35 are relevant. Calculate the precision, recall, and fallout.
3. Explain, in your own words, what it means for a search to have high precision but low recall.
