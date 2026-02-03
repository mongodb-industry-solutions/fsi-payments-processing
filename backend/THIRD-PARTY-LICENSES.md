# Third-Party Licenses — Backend

This document contains the licenses for all third-party packages used in the backend services.

Generated on: 2025-12-15

---

## Payment Converter Service (`payment_converter_v2`)

### pymongo (>=4.10.1)
- **License:** Apache License 2.0
- **Repository:** https://github.com/mongodb/mongo-python-driver
- **Description:** Python driver for MongoDB

### motor (>=3.3.2)
- **License:** Apache License 2.0
- **Repository:** https://github.com/mongodb/motor
- **Description:** Async Python driver for MongoDB

### fastapi (>=0.115.4)
- **License:** MIT License
- **Repository:** https://github.com/fastapi/fastapi
- **Description:** Modern web framework for building APIs

### uvicorn (>=0.32.0)
- **License:** BSD-3-Clause
- **Repository:** https://github.com/encode/uvicorn
- **Description:** ASGI web server implementation

### pydantic (>=2.5.0)
- **License:** MIT License
- **Repository:** https://github.com/pydantic/pydantic
- **Description:** Data validation using Python type annotations

### pydantic-settings (>=2.1.0)
- **License:** MIT License
- **Repository:** https://github.com/pydantic/pydantic-settings
- **Description:** Settings management using Pydantic

### boto3 (>=1.35.70)
- **License:** Apache License 2.0
- **Repository:** https://github.com/boto/boto3
- **Description:** AWS SDK for Python

### botocore (>=1.35.70)
- **License:** Apache License 2.0
- **Repository:** https://github.com/boto/botocore
- **Description:** Low-level interface to AWS services

### python-dotenv (>=1.0.1)
- **License:** BSD-3-Clause
- **Repository:** https://github.com/theskumar/python-dotenv
- **Description:** Read key-value pairs from .env file

### lxml (>=5.1.0)
- **License:** BSD-3-Clause
- **Repository:** https://github.com/lxml/lxml
- **Description:** XML and HTML processing library

### python-multipart (>=0.0.22)
- **License:** Apache License 2.0
- **Repository:** https://github.com/Kludex/python-multipart
- **Description:** Streaming multipart parser for Python

### httpx (>=0.27.0)
- **License:** BSD-3-Clause
- **Repository:** https://github.com/encode/httpx
- **Description:** Fully featured HTTP client for Python

### langgraph (>=0.2.0)
- **License:** MIT License
- **Repository:** https://github.com/langchain-ai/langgraph
- **Description:** Library for building stateful multi-actor applications

### langgraph-checkpoint (>=3.0)
- **License:** MIT License
- **Repository:** https://github.com/langchain-ai/langgraph
- **Description:** Checkpointing support for LangGraph workflows

### langgraph-checkpoint-mongodb (>=0.2.0)
- **License:** MIT License
- **Repository:** https://github.com/langchain-ai/langchain-mongodb
- **Description:** MongoDB checkpointing backend for LangGraph

### langchain-core (>=1.2.5)
- **License:** MIT License
- **Repository:** https://github.com/langchain-ai/langchain
- **Description:** Core components for LangChain

### langchain-aws (>=0.2.0)
- **License:** MIT License
- **Repository:** https://github.com/langchain-ai/langchain-aws
- **Description:** AWS integrations for LangChain (Bedrock, SageMaker)

### solana (>=0.34.0)
- **License:** MIT License
- **Repository:** https://github.com/michaelhly/solana-py
- **Description:** Python SDK for Solana blockchain

### solders (>=0.21.0)
- **License:** MIT License
- **Repository:** https://github.com/kevinheavey/solders
- **Description:** Rust-powered Solana SDK bindings for Python

### base58 (>=2.1.1)
- **License:** MIT License
- **Repository:** https://github.com/keis/base58
- **Description:** Base58 and Base58Check encoding/decoding

### urllib3 (>=2.6.0)
- **License:** MIT License
- **Repository:** https://github.com/urllib3/urllib3
- **Description:** HTTP client for Python

### pytest (>=8.0.0)
- **License:** MIT License
- **Repository:** https://github.com/pytest-dev/pytest
- **Description:** Python testing framework

### pytest-asyncio (>=0.23.0)
- **License:** Apache License 2.0
- **Repository:** https://github.com/pytest-dev/pytest-asyncio
- **Description:** Pytest support for asyncio

---

## Payment Agent Service (`payment_agent`)

### langchain (>=0.3.0)
- **License:** MIT License
- **Repository:** https://github.com/langchain-ai/langchain
- **Description:** Framework for developing LLM-powered applications

### langchain-anthropic (>=0.2.0)
- **License:** MIT License
- **Repository:** https://github.com/langchain-ai/langchain
- **Description:** Anthropic Claude integrations for LangChain

### voyageai (>=0.3.0)
- **License:** MIT License
- **Repository:** https://github.com/voyage-ai/voyageai-python
- **Description:** Python client for Voyage AI embedding API

### aiohttp (>=3.13.3)
- **License:** Apache License 2.0
- **Repository:** https://github.com/aio-libs/aiohttp
- **Description:** Async HTTP client/server framework

### filelock (>=3.20.3)
- **License:** The Unlicense
- **Repository:** https://github.com/tox-dev/filelock
- **Description:** Platform-independent file locking

> The following packages are also used by this service but already listed above: pymongo, fastapi, uvicorn, pydantic, pydantic-settings, boto3, python-dotenv, httpx, langgraph, langchain-core, langchain-aws, urllib3.

---

## License Texts

### Apache License 2.0

```text
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### MIT License

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### BSD-3-Clause License

```text
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### The Unlicense

```text
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute
this software, either in source code form or as a compiled binary, for any
purpose, commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this
software dedicate any and all copyright interest in the software to the
public domain. We make this dedication for the benefit of the public at large
and to the detriment of our heirs and successors. We intend this dedication
to be an overt act of relinquishment in perpetuity of all present and future
rights to this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

---

## Notes

This file lists the direct dependencies of the backend services. Each dependency may have its own transitive dependencies with their own licenses. For complete license information, refer to the individual package repositories.

To verify or update this information:

- `pip-licenses` — generate licenses list: `pip install pip-licenses && pip-licenses --format=markdown`
- Check individual package metadata: `pip show <package-name>`
