# COMPENDIUM
Compendium is a processor for generating, unifying and converting different input sources like [AsciiDoc](https://asciidoctor.org/docs/asciidoc-syntax-quick-reference/) files, [Markdown](https://guides.github.com/features/mastering-markdown/) files, [Confluence](https://confluence.atlassian.com/doc/confluence-wiki-markup-251003035.html) and HTML websites into different output formats. We can **select _all the content_** or only **_parts_ of it** from the input files and generate an AsciiDoc, Markdown, HTML or PDF as output. A composition of concise but detailed information about a particular subject obtained from different sources with the aim to be published in a single document, book or other publication.

## Operating Mode
Compendium uses a JSON Config file with two parts that define where and how to get the desired input data:
![BasicMainFlow](images/diagramsDrawio/BasicMainFlow.png)
### Config JSON
#### Input Sources
Compendium currently accepts AsciiDoc, Markdown, Confluence and HTML as input formats.

In this part of the configuration file define the sources of the input files, the types and assign a reference id or name to them.
  - reference: id of the source.
  - source_type: (i.e asciidoc, markdown, html-url, confluence).
  - source: URL or PATH where the information is located. (i.e. https://adcenter.pl.s2-eu.capgemini.com/confluence/)
  ```
  "sources": [
    {
      "reference": "project1",
      "source_type": "asciidoc",
      "source": "./test-data/input/input-data1"
    },
    {
      "reference": "project2",
      "source_type": "asciidoc",
      "source": "./test-data/input/input-data2"
    },
    {
      "reference": "confluence2",
      "source_type": "confluence",
      "source": "https://adcenter.pl.s2-eu.capgemini.com/confluence/",
      "space": "JQ",
      "context": "capgemini"
    }
  ]
  ```
[x] To read from confluence internal network add this arguments to the source part:
  - context: capgemini
  - space: space key of the project, all the urls of the project have this letters. i.e.: (https://adcenter.pl.s2-eu.capgemini.com/confluence/display/HD/2.+Objectives ) space ⇒ HD
  
[ ] To read from confluence private account add this arguments to the source part:
  - context: external
  - space: depend on the account, all the urls have a two or three letters / < context > /.
  

#### Documents and Sections
  - reference: it refers the source reference, must be the same (source id).
  - document: file name or name/id project inside source path referred (i.e 6.+Entity+relationship+diagram).
  - sections: section/s that you want to extract. If you want to extract all the content of the document you should leave this argument blank, but if you want to extract different sections, write them in an array. (i.e sections: [h1, h3])
  ```
  "documents": [
    {
      "reference": "project1",
      "document": "manual"
    },
    {
      "reference": "project2",
      "document": "brownfox2"
    },
    {
      "reference": "project2",
      "document": "paragraph1"
    },
    {
      "reference": "confluence2",
      "document": "Jump+the+queue+Home",
      "sections": ["Epic 2. Consult the queue"]
    }
  ]
  ```
### Types of Inputs available and parameters
- **AsciiDoc** documents:
  - source_type: asciidoc (reads directly from local .adoc documents)
  - source: Local Path.
- **Markdown** documents:
  - source_type: markdown (reads directly from local .md documents)
  - source: Local Path.
- **Confluence** pages:
  - source_type: confluence
  - source: base url of confluence account
  - context: capgemini (internal network) or external(private confluence account)
  - space: JQ (project space key)
- **HTML** pages directly from a website:
  - source_type: url-html
  - source: url
  In the url-html type the document part have an optional attribute: (document is an index, where we have to extract all the links from. And include them in the output file, so that we download all the pages from a site). The document has to be unique and consider the following:
    - document: index url
    - is_index: true or false (to indicate if we have to read an index)
### Types of Outputs available
- PDF
- HTML
- AsciiDoc
- Markdown

# COMPENDIUM Main Workflow
Compendium works like a merger and compiler. It gets pieces of information from different sources and formats, merges them into a single file and generates an output file with the desired output format (PDF, HTML, AsciiDoc or Markdown). 

In this section the main compilation and merging process is described:

![MainCompilationProcess](images/diagramsDrawio/CompilationFlow.png)

## Compiler - FRONTEND
1. **Lexical** Analysis:
    - The sequences of characters from the input files are tokenized in the Scanner or **Tokenization** process.
    - **_TextIn_** objects transform the input source code to an HTML tokenized code using [**_Asciidoctor.js_**](https://asciidoctor.org) for the AsciiDoc files or [**_Showdown.js_**](http://showdownjs.com/) for the Markdown files. Confluence data is recovered via JSON and can be transcoded directly. Obviously, HTML files are already tokenized.
2. **Syntax** Analysis:
    - The HTML tokenized code is *parsed* to a Parse Tree in the **Parsing** or Hierarchical Analysis process.
    - **_TextIn_** objects parse XML (HTML) code using [html-parser](https://www.npmjs.com/package/html-parser) generating a **Tree datastructure** that represents the content. **_TextIn_** objects then go through all of the branches of the parsed *Tree* returning **_`Array<TextSegment>`_** elements that will be used to generate the **_Transcript_** objects.
3. **Semantic** Analysis:
    - The **_`Array<TextSegment>`_** is iterated through filtering functions that remove the unwanted information.
      
At this point we have parsed all the input information and filtered it. We have an `Array<TextSegment>` with all the pieces of information from the sources.

## Compiler - MIDDLE END
4. **Intermediate Code Generation**:
    - The **_`Array<TextSegment>`_** that we generated on the previous steps is now used to create **_Transcript_** objects that will contain all the *TextSegments* information.
    - Our **_Transcript_** elements are an **intermediate representation** of the input source data that makes easier to work with them to generate the output file.
    
5. **Code Optimization**:
    - In this step, all the _Transcript elements are **merged**_ using the Merger into a single Transcript. The output is almost ready to generate a file with the selected output format.
    
## Compiler - BACKEND
6. **Output Code Generation**:
    - In this final step, our _Transcript_ elements are the input for the **_TextOut_** object that will generate the output code in the desired format. 
    - Transcript elements are used to generate an AsciiDoc that will be transformed to _HTML_ using [asciidoctor](https://asciidoctor.org/) that is used as Intermediate Code again for generating the correct output. Markdown is generated using [TurnDown service](https://github.com/domchristie/turndown) from the HTML code, PDF using [htmlto](https://www.npmjs.com/package/htmlto) also from the HTML and AsciiDoc directly from the code generated from the Transcript elements.
