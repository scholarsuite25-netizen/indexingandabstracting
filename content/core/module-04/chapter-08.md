---
id: chapter-08
source: supplied
module: 4
chapter: 8
title: "Post-Coordinate Indexing Systems"
position: 1
estimated_minutes: 3
required_reading_pct: 90
---

## Learning Objectives

By the end of this chapter, you should be able to:
- Define post-coordinate indexing.
- Explain how terms are combined at the point of retrieval.
- Describe free-text searching, Uniterm indexing, and optical coincidence systems.

## 8.1 What Is Post-Coordinate Indexing?

In post-coordinate indexing, concepts are assigned to a document separately, as individual terms, and it is the searcher or the retrieval system that combines them together at the moment of searching, rather than the indexer combining them in advance.

## EXAMPLE

A document might simply receive the three separate terms Artificial Intelligence, University Libraries, and Reference Services, without any single combined expression being created in advance. A user could later combine any two or three of these with AND to retrieve it.

## 8.2 Pre-Coordinate versus Post-Coordinate

The essential difference is timing. Pre-coordinate indexing combines concepts while the document is being indexed. Post-coordinate indexing leaves each term separately searchable and lets the combination happen later, during retrieval.

## 8.3 Free-Text Searching

Free-text searching looks for words directly within fields such as titles, abstracts, or the full text of a document, without relying entirely on a controlled vocabulary. This approach is flexible, but it can suffer from problems such as synonyms not being matched, ambiguous words, and variations in spelling.

## 8.4 Uniterm Indexing

Uniterm indexing is an early and influential example of the post-coordinate approach. It works by assigning individual, single terms to documents and then combining those terms only at the point of retrieval, illustrating the basic principle behind all post-coordinate systems.

## 8.5 Optical Coincidence Systems

Historically, optical coincidence systems used physical cards or other machine-readable formats to identify which documents shared a chosen set of terms. Modern digital Boolean searching performs the same essential logical operations, but does so electronically rather than mechanically.

## 8.6 Advantages and Limitations

Post-coordinate systems allow for flexible and often unexpected combinations of terms at search time, are well suited to computerised retrieval, and scale well to large databases. However, this flexibility comes at a cost: it places greater responsibility on the searcher to construct an effective query, results can be affected by inconsistent or uncontrolled terminology, and a poorly formed search can produce high recall but low precision.

## Review Questions

1. Define post-coordinate indexing in your own words.
2. Give two differences between pre-coordinate and post-coordinate indexing.
3. What is Uniterm indexing?
4. Why can post-coordinate searching produce high recall but low precision if handled poorly?
